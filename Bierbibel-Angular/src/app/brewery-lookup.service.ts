import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

export interface BrewerySuggestion {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  breweryType: string | null;
}

interface ApiBrewery {
  id: string;
  name: string;
  city: string | null;
  state_province: string | null;
  country: string | null;
  address_1: string | null;
  address_2: string | null;
  address_3: string | null;
  postal_code: string | null;
  brewery_type: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isApiBrewery(value: unknown): value is ApiBrewery {
  return isRecord(value)
    && typeof value['id'] === 'string'
    && typeof value['name'] === 'string'
    && isOptionalString(value['city'])
    && isOptionalString(value['state_province'])
    && isOptionalString(value['country'])
    && isOptionalString(value['address_1'])
    && isOptionalString(value['address_2'])
    && isOptionalString(value['address_3'])
    && isOptionalString(value['postal_code'])
    && isOptionalString(value['brewery_type']);
}

@Injectable({ providedIn: 'root' })
export class BreweryLookupService {
  private readonly http = inject(HttpClient);

  search(query: string): Observable<BrewerySuggestion[]> {
    const params = new HttpParams()
      .set('query', query)
      .set('per_page', '5');

    return this.http.get<unknown>('https://api.openbrewerydb.org/v1/breweries/search', { params }).pipe(
      map((payload) => {
        if (!Array.isArray(payload) || !payload.every(isApiBrewery)) {
          throw new Error('Die Brauereisuche hat ein unerwartetes Datenformat zurückgegeben.');
        }

        return payload.map((brewery) => ({
          id: brewery.id,
          name: brewery.name,
          city: brewery.city,
          state: brewery.state_province,
          country: brewery.country,
          address: [
            brewery.address_1,
            brewery.address_2,
            brewery.address_3,
            brewery.postal_code,
            brewery.city,
            brewery.state_province,
            brewery.country
          ].filter((part): part is string => part !== null && part.trim().length > 0).join(', ') || null,
          breweryType: brewery.brewery_type
        }));
      })
    );
  }
}
