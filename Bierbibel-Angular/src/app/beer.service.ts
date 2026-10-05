import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';

export interface BeerEntry {
  Brauerei: string;
  BierName: string;
  Art: string;
  Bewertung: string | number;
  marked?: boolean;
}

export interface IndexedBeer extends BeerEntry {
  index: number;
}

export interface BeerInput {
  brauerei: string;
  bierName: string;
  art: string;
  bewertung: number;
}

export type BeerField = 'Brauerei' | 'BierName' | 'Art' | 'Bewertung';

const STORAGE_KEY = 'bierbibel.beers.v1';

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

function isBeerList(value: unknown): value is BeerEntry[] {
  return Array.isArray(value) && value.every(isBeerEntry);
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

@Injectable({ providedIn: 'root' })
export class BeerService {
  private readonly http = inject(HttpClient);
  private beers: BeerEntry[] = [];
  private initialized = false;

  loadBeers(): Observable<IndexedBeer[]> {
    if (this.initialized) {
      try {
        const storedBeers = this.readStoredBeers();
        if (storedBeers) {
          this.beers = storedBeers;
        }
        return of(this.indexedBeers());
      } catch (error: unknown) {
        return throwError(() => error instanceof Error
          ? error
          : new Error('Gespeicherte Bierdaten konnten nicht gelesen werden.')
        );
      }
    }

    let storedBeers: BeerEntry[] | null;
    try {
      storedBeers = this.readStoredBeers();
    } catch (error: unknown) {
      return throwError(() => error instanceof Error
        ? error
        : new Error('Gespeicherte Bierdaten konnten nicht gelesen werden.')
      );
    }

    if (storedBeers) {
      this.beers = storedBeers;
      this.initialized = true;
      return of(this.indexedBeers());
    }

    return this.http.get<unknown>('assets/biere.json').pipe(
      map((payload) => {
        if (!isBeerList(payload)) {
          throw new Error('Die mitgelieferte Bierliste hat ein unerwartetes Datenformat.');
        }

        return payload;
      }),
      tap((beers) => {
        this.persistBeers(beers);
        this.beers = beers;
        this.initialized = true;
      }),
      map(() => this.indexedBeers()),
      catchError((error: unknown) => throwError(() =>
        error instanceof Error ? error : new Error('Die Bierliste konnte nicht geladen werden.')
      ))
    );
  }

  addBeer(beer: BeerInput): Observable<void> {
    return this.mutate(() => {
      this.beers.push({
        Brauerei: beer.brauerei,
        BierName: beer.bierName,
        Art: beer.art,
        Bewertung: beer.bewertung
      });
    });
  }

  deleteBeer(index: number): Observable<void> {
    return this.mutate(() => {
      this.assertIndex(index);
      this.beers.splice(index, 1);
    });
  }

  markBeer(index: number): Observable<void> {
    return this.mutate(() => {
      this.assertIndex(index);
      this.beers[index].marked = true;
    });
  }

  unmarkBeer(index: number): Observable<void> {
    return this.mutate(() => {
      this.assertIndex(index);
      delete this.beers[index].marked;
    });
  }

  private mutate(change: () => void): Observable<void> {
    const previousBeers = this.beers.map((beer) => ({ ...beer }));
    try {
      if (!this.initialized) {
        throw new Error('Die Bierliste ist noch nicht geladen.');
      }

      change();
      this.persistBeers();
      return of(void 0);
    } catch (error: unknown) {
      this.beers = previousBeers;
      return throwError(() => error instanceof Error
        ? error
        : new Error('Die Änderung konnte nicht gespeichert werden.')
      );
    }
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.beers.length) {
      throw new Error('Der ausgewählte Biereintrag ist nicht mehr vorhanden.');
    }
  }

  private readStoredBeers(): BeerEntry[] | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(stored);
      if (!isBeerList(parsed)) {
        throw new Error('Gespeicherte Bierdaten sind ungültig. Leere den Website-Speicher, um die Ausgangsliste neu zu laden.');
      }

      return parsed;
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        throw new Error('Gespeicherte Bierdaten konnten nicht gelesen werden. Leere den Website-Speicher, um die Ausgangsliste neu zu laden.');
      }

      throw error instanceof Error
        ? error
        : new Error('Der Website-Speicher ist nicht verfügbar.');
    }
  }

  private persistBeers(beers: BeerEntry[] = this.beers): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(beers));
    } catch {
      throw new Error('Änderungen konnten nicht im Browser gespeichert werden. Prüfe, ob der Website-Speicher verfügbar ist.');
    }
  }

  private indexedBeers(): IndexedBeer[] {
    return this.beers.map((beer, index) => ({ ...beer, index }));
  }
}
