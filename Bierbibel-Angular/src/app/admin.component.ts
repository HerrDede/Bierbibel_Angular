import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BeerField, BeerInput, BeerService, compareBeerField, IndexedBeer } from './beer.service';
import { LoginPanelComponent } from './login-panel.component';

type AdminSortKey = BeerField;
type BeerFormState = Omit<BeerInput, 'bewertung'> & { bewertung: number | null };

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginPanelComponent],
  templateUrl: './admin.component.html'
})
export class AdminComponent {
  private readonly beerService = inject(BeerService);

  authenticated = false;
  beers: IndexedBeer[] = [];
  searchTerm = '';
  form: BeerFormState = { brauerei: '', bierName: '', art: '', bewertung: null };
  sortKey: AdminSortKey | null = null;
  sortDirection = 1;
  loading = false;
  saving = false;
  pendingDeleteIndex: number | null = null;
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

    if (!this.sortKey) {
      return entries;
    }

    const sortKey = this.sortKey;
    return entries.sort((first, second) =>
      compareBeerField(first, second, sortKey) * this.sortDirection
    );
  }

  setAuthenticated(authenticated: boolean): void {
    this.authenticated = authenticated;
    if (authenticated) {
      this.loadBeers();
    }
  }

  sortBy(key: AdminSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection *= -1;
      return;
    }

    this.sortKey = key;
    this.sortDirection = key === 'Bewertung' ? -1 : 1;
  }

  sortIndicator(key: AdminSortKey): string {
    return key === this.sortKey ? (this.sortDirection > 0 ? '↑' : '↓') : '';
  }

  addBeer(): void {
    if (this.saving || this.form.bewertung === null) {
      return;
    }

    this.saving = true;
    this.message = '';
    this.errorMessage = '';
    this.beerService.addBeer({
      brauerei: this.form.brauerei.trim(),
      bierName: this.form.bierName.trim(),
      art: this.form.art.trim(),
      bewertung: this.form.bewertung
    }).subscribe({
      next: () => {
        this.saving = false;
        this.form = { brauerei: '', bierName: '', art: '', bewertung: null };
        this.message = 'Bier wurde hinzugefügt.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.errorMessage = this.errorText('Das Bier konnte nicht hinzugefügt werden.', error);
      }
    });
  }

  deleteBeer(beer: IndexedBeer): void {
    if (this.pendingDeleteIndex !== null || !window.confirm(`„${beer.BierName}“ wirklich löschen?`)) {
      return;
    }

    this.pendingDeleteIndex = beer.index;
    this.message = '';
    this.errorMessage = '';
    this.beerService.deleteBeer(beer.index).subscribe({
      next: () => {
        this.pendingDeleteIndex = null;
        this.message = 'Bier wurde gelöscht.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.pendingDeleteIndex = null;
        this.errorMessage = this.errorText('Das Bier konnte nicht gelöscht werden.', error);
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
