import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BeerField, BeerService, compareBeerField, IndexedBeer } from './beer.service';

type SortKey = BeerField;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private readonly beerService = inject(BeerService);

  beers: IndexedBeer[] = [];
  searchTerm = '';
  sortKey: SortKey = 'Bewertung';
  sortDirection = -1;
  loading = false;
  errorMessage = '';

  constructor() {
    this.loadBeers();
  }

  get latestBeer(): IndexedBeer | null {
    return this.beers[this.beers.length - 1] ?? null;
  }

  get visibleBeers(): IndexedBeer[] {
    const query = this.searchTerm.trim().toLocaleLowerCase('de');
    const entries = query
      ? this.beers.filter((beer) =>
          `${beer.Brauerei} ${beer.BierName} ${beer.Art} ${beer.Bewertung}`
            .toLocaleLowerCase('de')
            .includes(query)
        )
      : [...this.beers];

    return entries.sort((first, second) => this.compare(first, second));
  }

  loadBeers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.beerService.loadBeers().subscribe({
      next: (beers) => {
        this.beers = beers;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = error instanceof HttpErrorResponse
          ? `Die Bierliste konnte nicht geladen werden (HTTP ${error.status}).`
          : error instanceof Error
            ? error.message
            : 'Die Bierliste konnte nicht geladen werden.';
      }
    });
  }

  sortBy(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDirection *= -1;
      return;
    }

    this.sortKey = key;
    this.sortDirection = key === 'Bewertung' ? -1 : 1;
  }

  sortIndicator(key: SortKey): string {
    if (key !== this.sortKey) {
      return '';
    }

    return this.sortDirection === 1 ? '↑' : '↓';
  }

  imageSearchUrl(beer: IndexedBeer): string {
    const query = encodeURIComponent(`${beer.Brauerei} Brauerei ${beer.BierName}`);
    return `https://www.google.com/search?tbm=isch&q=${query}`;
  }

  rating(value: string | number): string | number {
    return value;
  }

  provideHapticFeedback(): void {
    navigator.vibrate?.(50);
  }

  private compare(first: IndexedBeer, second: IndexedBeer): number {
    const direction = this.sortDirection;

    return compareBeerField(first, second, this.sortKey) * direction;
  }
}
