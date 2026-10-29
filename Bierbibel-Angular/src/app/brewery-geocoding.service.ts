import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

export interface BreweryCoordinatesRequest {
  id: string;
  address: string;
}

export interface BreweryCoordinates {
  id: string;
  latitude: number | null;
  longitude: number | null;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorFromResponse(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    if (isRecord(error.error) && typeof error.error['error'] === 'string') {
      return new Error(error.error['error']);
    }

    return new Error(`Die Adressen konnten nicht geocodiert werden (HTTP ${error.status}).`);
  }

  return error instanceof Error ? error : new Error('Die Adressen konnten nicht geocodiert werden.');
}

@Injectable({ providedIn: 'root' })
export class BreweryGeocodingService {
  private readonly http = inject(HttpClient);
  private readonly cacheKey = 'bierbibel-brewery-coordinates-v1';
  private readonly coordinatesByAddress = new Map<string, BreweryCoordinates>();
  private cacheLoaded = false;

  geocode(locations: BreweryCoordinatesRequest[]): Observable<BreweryCoordinates[]> {
    this.loadCache();
    const unresolved = locations.filter((location) => !this.coordinatesByAddress.has(this.addressKey(location.address)));
    if (unresolved.length === 0) {
      return of(locations.map((location) => ({
        ...this.coordinatesByAddress.get(this.addressKey(location.address))!,
        id: location.id
      })));
    }

    return this.http.post<unknown>('/api/geocode', { locations: unresolved }).pipe(
      map((payload) => {
        if (!isRecord(payload) || !Array.isArray(payload['results'])) {
          throw new Error('Der Geocoding-Dienst hat ein unerwartetes Datenformat zurückgegeben.');
        }

        const results = payload['results'].map((result: unknown) => {
          if (!isRecord(result)
            || typeof result['id'] !== 'string'
            || !(result['latitude'] === null || (typeof result['latitude'] === 'number' && Number.isFinite(result['latitude'])))
            || !(result['longitude'] === null || (typeof result['longitude'] === 'number' && Number.isFinite(result['longitude'])))
            || (result['error'] !== undefined && typeof result['error'] !== 'string')) {
            throw new Error('Der Geocoding-Dienst hat ein ungültiges Koordinatenergebnis zurückgegeben.');
          }

          return {
            id: result['id'],
            latitude: result['latitude'],
            longitude: result['longitude'],
            ...(typeof result['error'] === 'string' ? { error: result['error'] } : {})
          };
        });

        const resultsById = new Map<string, BreweryCoordinates>(results.map((result) => [result.id, result]));
        for (const location of unresolved) {
          const result = resultsById.get(location.id);
          if (result && result.latitude !== null && result.longitude !== null) {
            this.coordinatesByAddress.set(this.addressKey(location.address), result);
          }
        }
        this.saveCache();

        return locations.map((location) => {
          const cachedCoordinates = this.coordinatesByAddress.get(this.addressKey(location.address));
          if (cachedCoordinates) {
            return { ...cachedCoordinates, id: location.id };
          }

          return resultsById.get(location.id) ?? {
            id: location.id,
            latitude: null,
            longitude: null,
            error: 'Keine Koordinaten wurden zurückgegeben.'
          };
        });
      }),
      catchError((error: unknown) => throwError(() => errorFromResponse(error)))
    );
  }

  private loadCache(): void {
    if (this.cacheLoaded) {
      return;
    }

    this.cacheLoaded = true;
    try {
      const cachedValue: unknown = JSON.parse(localStorage.getItem(this.cacheKey) ?? '{}');
      if (!isRecord(cachedValue)) {
        return;
      }

      for (const [address, value] of Object.entries(cachedValue)) {
        if (isRecord(value)
          && typeof value['id'] === 'string'
          && typeof value['latitude'] === 'number' && Number.isFinite(value['latitude'])
          && typeof value['longitude'] === 'number' && Number.isFinite(value['longitude'])) {
          this.coordinatesByAddress.set(address, {
            id: value['id'],
            latitude: value['latitude'],
            longitude: value['longitude']
          });
        }
      }
    } catch {
      this.coordinatesByAddress.clear();
    }
  }

  private saveCache(): void {
    const cache = Object.fromEntries(
      Array.from(this.coordinatesByAddress, ([address, coordinates]) => [
        address,
        {
          id: coordinates.id,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        }
      ])
    );
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch {
      return;
    }
  }

  private addressKey(address: string): string {
    return address.trim().toLocaleLowerCase('de');
  }
}
