import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, Subject, switchMap, tap } from 'rxjs';
import { BeerField, BeerInput, BeerService, compareBeerField, IndexedBeer } from './beer.service';
import { BreweryLookupService, BrewerySuggestion } from './brewery-lookup.service';
import { LoginPanelComponent } from './login-panel.component';

type AdminSortKey = BeerField;
type BeerFormState = Omit<BeerInput, 'bewertung'> & { bewertung: number | null };

interface BrewerySearchState {
  suggestions: BrewerySuggestion[];
  query: string;
  suggestionQuery: string;
  loading: boolean;
  error: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginPanelComponent],
  templateUrl: './admin.component.html'
})
export class AdminComponent {
  private readonly beerService = inject(BeerService);
  private readonly breweryLookup = inject(BreweryLookupService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly brewerySearchTerms = new Subject<string>();
  private readonly editBrewerySearchTerms = new Subject<string>();

  authenticated = false;
  beers: IndexedBeer[] = [];
  searchTerm = '';
  form: BeerFormState = { brauerei: '', bierName: '', art: '', bewertung: null, adresse: null };
  editingBeerId: number | null = null;
  editForm: BeerFormState = { brauerei: '', bierName: '', art: '', bewertung: null, adresse: null };
  sortKey: AdminSortKey | null = null;
  sortDirection = 1;
  loading = false;
  saving = false;
  savingEdit = false;
  pendingDeleteId: number | null = null;
  importing = false;
  message = '';
  errorMessage = '';
  readonly brewerySearch: BrewerySearchState = this.createBrewerySearchState();
  readonly editBrewerySearch: BrewerySearchState = this.createBrewerySearchState();

  constructor() {
    this.connectBrewerySearch(this.brewerySearchTerms, this.brewerySearch);
    this.connectBrewerySearch(this.editBrewerySearchTerms, this.editBrewerySearch);
  }

  private connectBrewerySearch(terms: Subject<string>, state: BrewerySearchState): void {
    terms.pipe(
      debounceTime(350),
      map((term) => term.trim()),
      switchMap((term) => {
        if (term.length < 3) {
          state.loading = false;
          return of({ term, suggestions: [] as BrewerySuggestion[] });
        }

        state.loading = true;
        state.error = '';
        return this.breweryLookup.search(term).pipe(
          tap(() => {
            state.loading = false;
          }),
          map((suggestions) => ({ term, suggestions })),
          catchError((error: unknown) => {
            state.loading = false;
            state.error = this.brewerySearchErrorText(error);
            return of({ term, suggestions: [] as BrewerySuggestion[] });
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({ term, suggestions }) => {
      if (term.toLocaleLowerCase('de') !== state.query.toLocaleLowerCase('de')) {
        return;
      }

      state.suggestionQuery = term;
      state.suggestions = suggestions;
    });
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

  searchBreweries(name: string, target: 'add' | 'edit' = 'add'): void {
    const state = target === 'add' ? this.brewerySearch : this.editBrewerySearch;
    const terms = target === 'add' ? this.brewerySearchTerms : this.editBrewerySearchTerms;
    if (target === 'edit') {
      if (this.editForm.brauerei !== name) {
        this.editForm.adresse = null;
      }
      this.editForm.brauerei = name;
    } else {
      if (this.form.brauerei !== name) {
        this.form.adresse = null;
      }
      this.form.brauerei = name;
    }

    state.query = name.trim();
    state.suggestions = [];
    state.suggestionQuery = '';
    state.error = '';
    terms.next(name);
  }

  selectBrewery(suggestion: BrewerySuggestion, target: 'add' | 'edit' = 'add'): void {
    const state = target === 'add' ? this.brewerySearch : this.editBrewerySearch;
    const terms = target === 'add' ? this.brewerySearchTerms : this.editBrewerySearchTerms;
    if (target === 'add') {
      this.form.brauerei = suggestion.name;
      this.form.adresse = suggestion.address;
    } else {
      this.editForm.brauerei = suggestion.name;
      this.editForm.adresse = suggestion.address;
    }

    state.query = '';
    state.suggestionQuery = '';
    state.suggestions = [];
    state.error = '';
    state.loading = false;
    terms.next('');
  }

  breweryLocation(suggestion: BrewerySuggestion): string {
    return [suggestion.city, suggestion.state, suggestion.country]
      .filter((part): part is string => part !== null && part.length > 0)
      .join(', ');
  }

  addBeer(): void {
    if (this.saving || this.savingEdit || this.pendingDeleteId !== null || this.form.bewertung === null) {
      return;
    }

    this.saving = true;
    this.message = '';
    this.errorMessage = '';
    this.beerService.addBeer({
      brauerei: this.form.brauerei.trim(),
      bierName: this.form.bierName.trim(),
      art: this.form.art.trim(),
      bewertung: this.form.bewertung,
      adresse: this.form.adresse
    }).subscribe({
      next: () => {
        this.saving = false;
        this.form = { brauerei: '', bierName: '', art: '', bewertung: null, adresse: null };
        this.resetBrewerySearch(this.brewerySearch, this.brewerySearchTerms);
        this.message = 'Bier wurde hinzugefügt.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.errorMessage = this.errorText('Das Bier konnte nicht hinzugefügt werden.', error);
      }
    });
  }

  startEditing(beer: IndexedBeer): void {
    if (this.saving || this.savingEdit || this.pendingDeleteId !== null) {
      return;
    }

    this.editingBeerId = beer.id;
    this.editForm = {
      brauerei: beer.Brauerei,
      bierName: beer.BierName,
      art: beer.Art,
      bewertung: Number(beer.Bewertung),
      adresse: beer.Adresse ?? null
    };
    this.resetBrewerySearch(this.editBrewerySearch, this.editBrewerySearchTerms);
    this.message = '';
    this.errorMessage = '';
  }

  cancelEditing(): void {
    if (this.savingEdit) {
      return;
    }

    this.editingBeerId = null;
    this.editForm = { brauerei: '', bierName: '', art: '', bewertung: null, adresse: null };
    this.resetBrewerySearch(this.editBrewerySearch, this.editBrewerySearchTerms);
  }

  saveEdit(beer: IndexedBeer): void {
    if (this.savingEdit || this.saving || this.pendingDeleteId !== null || this.editForm.bewertung === null) {
      return;
    }

    const brauerei = this.editForm.brauerei.trim();
    const bierName = this.editForm.bierName.trim();
    const art = this.editForm.art.trim();
    if (!brauerei || !bierName || !art || !Number.isFinite(this.editForm.bewertung)) {
      this.errorMessage = 'Bitte fülle alle Felder mit gültigen Werten aus.';
      return;
    }

    this.savingEdit = true;
    this.message = '';
    this.errorMessage = '';
    this.beerService.updateBeer(beer.id, {
      brauerei,
      bierName,
      art,
      bewertung: this.editForm.bewertung,
      adresse: this.editForm.adresse
    }).subscribe({
      next: () => {
        this.savingEdit = false;
        this.editingBeerId = null;
        this.editForm = { brauerei: '', bierName: '', art: '', bewertung: null, adresse: null };
        this.resetBrewerySearch(this.editBrewerySearch, this.editBrewerySearchTerms);
        this.message = 'Biereintrag wurde aktualisiert.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.savingEdit = false;
        this.errorMessage = this.errorText('Der Biereintrag konnte nicht aktualisiert werden.', error);
      }
    });
  }

  importStartingList(): void {
    if (this.importing || this.loading || this.beers.length > 0) {
      return;
    }

    this.importing = true;
    this.message = '';
    this.errorMessage = '';
    this.beerService.importBundledList().subscribe({
      next: () => {
        this.importing = false;
        this.message = 'Die Startliste wurde in die gemeinsame Datenbank importiert.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.importing = false;
        this.errorMessage = this.errorText('Die Startliste konnte nicht importiert werden.', error);
      }
    });
  }

  deleteBeer(beer: IndexedBeer): void {
    if (this.pendingDeleteId !== null || this.saving || this.savingEdit
      || !window.confirm(`„${beer.BierName}“ wirklich löschen?`)) {
      return;
    }

    this.pendingDeleteId = beer.id;
    this.message = '';
    this.errorMessage = '';
    this.beerService.deleteBeer(beer.id).subscribe({
      next: () => {
        this.pendingDeleteId = null;
        this.message = 'Bier wurde gelöscht.';
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.pendingDeleteId = null;
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

  private createBrewerySearchState(): BrewerySearchState {
    return { suggestions: [], query: '', suggestionQuery: '', loading: false, error: '' };
  }

  private resetBrewerySearch(state: BrewerySearchState, terms: Subject<string>): void {
    state.query = '';
    state.suggestionQuery = '';
    state.suggestions = [];
    state.loading = false;
    state.error = '';
    terms.next('');
  }

  private brewerySearchErrorText(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return `Brauereivorschläge sind gerade nicht verfügbar (HTTP ${error.status}).`;
    }

    return error instanceof Error
      ? error.message
      : 'Brauereivorschläge sind gerade nicht verfügbar.';
  }
}
