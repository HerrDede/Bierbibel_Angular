import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, switchMap, throwError } from 'rxjs';

export interface BeerEntry {
  Brauerei: string;
  BierName: string;
  Art: string;
  Bewertung: string | number;
  marked?: boolean;
}

export interface IndexedBeer extends BeerEntry {
  id: number;
}

export interface BeerInput {
  brauerei: string;
  bierName: string;
  art: string;
  bewertung: number;
}

export type BeerField = 'Brauerei' | 'BierName' | 'Art' | 'Bewertung';

interface ApiBeer extends BeerEntry {
  id: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBeerEntry(value: unknown): value is BeerEntry {
  if (!isRecord(value)) {
    return false;
  }

  const rating = value['Bewertung'];
  return typeof value['Brauerei'] === 'string'
    && typeof value['BierName'] === 'string'
    && typeof value['Art'] === 'string'
    && (typeof rating === 'string' || (typeof rating === 'number' && Number.isFinite(rating)))
    && (value['marked'] === undefined || typeof value['marked'] === 'boolean');
}

function errorFromResponse(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    if (isRecord(error.error) && typeof error.error['error'] === 'string') {
      return new Error(error.error['error']);
    }

    if (typeof error.error === 'string' && error.error) {
      return new Error(error.error);
    }

    return new Error(`Die Serveranfrage ist fehlgeschlagen (HTTP ${error.status}).`);
  }

  return error instanceof Error ? error : new Error('Die Serveranfrage ist fehlgeschlagen.');
}

@Injectable({ providedIn: 'root' })
export class BeerService {
  private readonly http = inject(HttpClient);

  loadBeers(): Observable<IndexedBeer[]> {
    return this.http.get<ApiBeer[]>('/api/beers').pipe(
      map((beers) => beers.map((beer) => ({ ...beer, marked: Boolean(beer.marked) }))),
      catchError((error: unknown) => throwError(() => errorFromResponse(error)))
    );
  }

  addBeer(beer: BeerInput): Observable<void> {
    return this.http.post('/api/beers', beer).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => errorFromResponse(error)))
    );
  }

  deleteBeer(id: number): Observable<void> {
    return this.http.delete(`/api/beers/${id}`).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => errorFromResponse(error)))
    );
  }

  markBeer(id: number): Observable<void> {
    return this.setMarked(id, true);
  }

  unmarkBeer(id: number): Observable<void> {
    return this.setMarked(id, false);
  }

  importBundledList(): Observable<void> {
    return this.http.get<unknown>('assets/biere.json').pipe(
      switchMap((payload) => {
        if (!Array.isArray(payload) || !payload.every(isBeerEntry) || payload.length === 0) {
          return throwError(() => new Error('Die mitgelieferte Bierliste hat ein unerwartetes Datenformat.'));
        }

        return this.http.post('/api/admin/import', payload);
      }),
      map(() => undefined),
      catchError((error: unknown) => throwError(() => errorFromResponse(error)))
    );
  }

  private setMarked(id: number, marked: boolean): Observable<void> {
    return this.http.patch(`/api/beers/${id}`, { marked }).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => errorFromResponse(error)))
    );
  }
}

export function compareBeerField(first: BeerEntry, second: BeerEntry, key: BeerField): number {
  const firstValue = first[key];
  const secondValue = second[key];

  if (key === 'Bewertung') {
    const firstRating = Number(firstValue);
    const secondRating = Number(secondValue);
    if (Number.isFinite(firstRating) && Number.isFinite(secondRating)) {
      return firstRating - secondRating;
    }
  }

  return String(firstValue).localeCompare(String(secondValue), 'de');
}
