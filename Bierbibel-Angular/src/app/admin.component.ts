import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BeerField, BeerInput, BeerService, compareBeerField, GeocodeBatchResult, IndexedBeer } from './beer.service';
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
  editingBeerId: number | null = null;
  editForm: BeerFormState = { brauerei: '', bierName: '', art: '', bewertung: null };
  sortKey: AdminSortKey | null = null;
  sortDirection = 1;
  loading = false;
  saving = false;
  savingEdit = false;
  pendingDeleteId: number | null = null;
  importing = false;
  geocoding = false;
  geocodeProcessed = 0;
  geocodeFound = 0;
  geocodeNotFound = 0;
  message = '';
  errorMessage = '';

  private geocodeAfterLoad = false;

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
      this.geocodeAfterLoad = true;
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
      bewertung: this.form.bewertung
    }).subscribe({
      next: (result) => {
        this.saving = false;
        this.form = { brauerei: '', bierName: '', art: '', bewertung: null };
        this.message = this.locationMessage('Bier wurde hinzugefügt.', result.locationStatus);
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
      bewertung: Number(beer.Bewertung)
    };
    this.message = '';
    this.errorMessage = '';
  }

  cancelEditing(): void {
    if (this.savingEdit) {
      return;
    }

    this.editingBeerId = null;
    this.editForm = { brauerei: '', bierName: '', art: '', bewertung: null };
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
      bewertung: this.editForm.bewertung
    }).subscribe({
      next: (result) => {
        this.savingEdit = false;
        this.editingBeerId = null;
        this.editForm = { brauerei: '', bierName: '', art: '', bewertung: null };
        this.message = this.locationMessage('Biereintrag wurde aktualisiert.', result.locationStatus);
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
        this.geocodeAfterLoad = true;
        this.loadBeers();
      },
      error: (error: unknown) => {
        this.importing = false;
        this.errorMessage = this.errorText('Die Startliste konnte nicht importiert werden.', error);
      }
    });
  }

  geocodeExistingBreweries(): void {
    if (!this.authenticated || this.geocoding || this.loading || this.beers.length === 0) {
      return;
    }

    this.geocoding = true;
    this.geocodeProcessed = 0;
    this.geocodeFound = 0;
    this.geocodeNotFound = 0;
    this.message = '';
    this.errorMessage = '';
    this.geocodeNextBatch();
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
        if (this.geocodeAfterLoad) {
          this.geocodeAfterLoad = false;
          this.geocodeExistingBreweries();
        }
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = this.errorText('Die Bierliste konnte nicht geladen werden.', error);
      }
    });
  }

  private geocodeNextBatch(): void {
    this.beerService.geocodeMissingBreweries().subscribe({
      next: (result: GeocodeBatchResult) => {
        this.geocodeProcessed += result.processed;
        this.geocodeFound += result.found;
        this.geocodeNotFound += result.notFound;

        if (result.remaining > 0) {
          this.message = `Standortsuche läuft: ${this.geocodeProcessed} Brauereien bearbeitet, ${result.remaining} noch offen.`;
          this.geocodeNextBatch();
          return;
        }

        this.geocoding = false;
        this.message = `Standortsuche abgeschlossen: ${this.geocodeFound} gefunden, ${this.geocodeNotFound} ohne Treffer.`;
      },
      error: (error: unknown) => {
        this.geocoding = false;
        this.errorMessage = this.errorText('Die Standorte konnten nicht vollständig gesucht werden.', error);
      }
    });
  }

  private locationMessage(
    message: string,
    status: 'found' | 'not_found' | 'unavailable'
  ): string {
    if (status === 'found') {
      return `${message} Standort ist auf der Karte verfügbar.`;
    }
    if (status === 'not_found') {
      return `${message} Für diese Brauerei wurde keine Adresse gefunden.`;
    }
    return `${message} Standortsuche nicht verfügbar; du kannst sie später erneut starten.`;
  }

  private errorText(message: string, error: unknown): string {
    return error instanceof Error ? error.message : message;
  }
}
