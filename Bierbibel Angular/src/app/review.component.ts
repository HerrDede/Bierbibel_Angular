import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BeerField, BeerService, compareBeerField, IndexedBeer } from './beer.service';
import { LoginPanelComponent } from './login-panel.component';

type ReviewSortKey = BeerField;

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginPanelComponent],
  templateUrl: './review.component.html'
})
export class ReviewComponent {
  private readonly beerService = inject(BeerService);

  authenticated = false;
  beers: IndexedBeer[] = [];
  searchTerm = '';
  sortKey: ReviewSortKey = 'BierName';
  sortDirection = 1;
  loading = false;
  pendingIndex: number | null = null;
  message = '';
  errorMessage = '';

  get visibleBeers(): IndexedBeer[] {
    const query = this.searchTerm.trim().toLocaleLowerCase('de');
    const entries = query
      ? this.beers.filter((beer) =>
          `${beer.Brauerei} ${beer.BierName} ${beer.Art} ${beer.Bewertung}`
            .toLocaleLowerCase('de')
            .includes(query)
        )
      : [...this.beers];

    return entries.sort((first, second) =>
      compareBeerField(first, second, this.sortKey) * this.sortDirection
    );
  }

  setAuthenticated(authenticated: boolean): void {
    this.authenticated = authenticated;
    if (authenticated) {
      this.loadBeers();
    }
  }

  sortBy(key: ReviewSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection *= -1;
    } else {
      this.sortKey = key;
      this.sortDirection = key === 'Bewertung' ? -1 : 1;
    }
  }

  sortIndicator(key: ReviewSortKey): string {
    return key === this.sortKey ? (this.sortDirection > 0 ? '↑' : '↓') : '';
  }

  changeMark(beer: IndexedBeer): void {
    if (this.pendingIndex !== null) {
      return;
    }

    this.pendingIndex = beer.index;
    this.message = '';
    this.errorMessage = '';
    const request = beer.marked
      ? this.beerService.unmarkBeer(beer.index)
      : this.beerService.markBeer(beer.index);

    request.subscribe({
      next: () => {
        this.pendingIndex = null;
        this.message = beer.marked ? 'Markierung entfernt.' : 'Bier zur Neubewertung angemeldet.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.pendingIndex = null;
        this.errorMessage = this.errorText('Die Markierung konnte nicht geändert werden.', error);
      }
    });
  }

  private loadBeers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.beerService.loadBeers().subscribe({
      next: (beers) => {
        this.beers = beers;
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = this.errorText('Die Bierliste konnte nicht geladen werden.', error);
      }
    });
  }

  private errorText(message: string, error: unknown): string {
    return error instanceof Error ? error.message : message;
  }
}
