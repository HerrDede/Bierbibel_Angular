import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, inject, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { concatMap, from, map, toArray } from 'rxjs';
import { BeerService, IndexedBeer } from './beer.service';
import { BreweryCoordinates, BreweryGeocodingService } from './brewery-geocoding.service';

interface BreweryLocation {
  id: string;
  name: string;
  address: string;
  beers: IndexedBeer[];
  latitude: number | null;
  longitude: number | null;
  geocodingError?: string;
}

@Component({
  selector: 'app-brewery-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brewery-map.component.html',
  styleUrl: './brewery-map.component.css'
})
export class BreweryMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;

  private readonly beerService = inject(BeerService);
  private readonly geocodingService = inject(BreweryGeocodingService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private map: L.Map | null = null;
  private readonly markers = L.featureGroup();
  private loadedBeers = false;
  private mapInitialized = false;
  private geocodingStarted = false;

  beers: IndexedBeer[] = [];
  locations: BreweryLocation[] = [];
  selectedBrewery: BreweryLocation | null = null;
  loading = false;
  geocoding = false;
  errorMessage = '';
  geocodingWarnings: string[] = [];
  breweryPopupPosition = { left: 0, top: 0, below: false };

  constructor() {
    this.loadBeers();
  }

  ngAfterViewInit(): void {
    if (!this.mapContainer) {
      this.errorMessage = 'Die Karte konnte nicht initialisiert werden.';
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, { scrollWheelZoom: false })
      .setView([51.1657, 10.4515], 6);
    this.map.on('move zoom', this.updateBreweryPopupPosition);
    this.map.on('click', this.closeBreweryPopup);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
    }).addTo(this.map);

    this.markers.addTo(this.map);
    this.mapInitialized = true;
    requestAnimationFrame(() => this.map?.invalidateSize());
    this.startGeocodingWhenReady();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  loadBeers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.geocodingWarnings = [];
    this.selectedBrewery = null;
    this.beerService.loadBeers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (beers) => {
        this.beers = beers;
        this.loadedBeers = true;
        this.loading = false;
        this.geocodingStarted = false;
        this.locations = this.groupBreweries(beers);
        this.markers.clearLayers();
        this.startGeocodingWhenReady();
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

  private startGeocodingWhenReady(): void {
    if (!this.loadedBeers || !this.mapInitialized || this.geocodingStarted) {
      return;
    }

    this.geocodingStarted = true;
    if (this.locations.length === 0) {
      return;
    }

    this.geocoding = true;
    const batches: BreweryLocation[][] = [];
    for (let index = 0; index < this.locations.length; index += 50) {
      batches.push(this.locations.slice(index, index + 50));
    }

    from(batches).pipe(
      concatMap((batch) => this.geocodingService.geocode(
        batch.map(({ id, address }) => ({ id, address }))
      )),
      toArray(),
      map((batchResults) => batchResults.flat()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (results) => {
        this.geocoding = false;
        const byId = new Map<string, BreweryCoordinates>(results.map((result) => [result.id, result]));
        this.locations = this.locations.map((location) => {
          const result = byId.get(location.id);
          if (!result) {
            this.geocodingWarnings.push(`${location.name}: Koordinaten fehlen in der Serverantwort.`);
            return location;
          }

          if (result.latitude === null || result.longitude === null) {
            this.geocodingWarnings.push(`${location.name}: ${result.error ?? 'Keine Koordinaten gefunden.'}`);
            return { ...location, geocodingError: result.error ?? 'Keine Koordinaten gefunden.' };
          }

          return { ...location, latitude: result.latitude, longitude: result.longitude };
        });
        this.showMarkers();
      },
      error: (error: unknown) => {
        this.geocoding = false;
        this.errorMessage = error instanceof Error
          ? error.message
          : 'Die Brauereiadressen konnten nicht auf der Karte angezeigt werden.';
      }
    });
  }

  private showMarkers(): void {
    this.markers.clearLayers();
    const coordinates = this.locations.filter(
      (location): location is BreweryLocation & { latitude: number; longitude: number } =>
        location.latitude !== null && location.longitude !== null
    );

    for (const location of coordinates) {
      const marker = L.circleMarker([location.latitude, location.longitude], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: '#477b79',
        fillOpacity: 0.95,
        bubblingMouseEvents: false
      }).bindTooltip(location.name);
      marker.on('click', () => {
        this.ngZone.run(() => {
          this.selectedBrewery = location;
          this.positionBreweryPopup(location);
        });
      });
      this.markers.addLayer(marker);
    }

    if (coordinates.length === 1) {
      const location = coordinates[0];
      this.map?.setView([location.latitude, location.longitude], 12);
    } else if (coordinates.length > 1) {
      this.map?.fitBounds(this.markers.getBounds().pad(0.12), { maxZoom: 12 });
    }

    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  closeBreweryPopup = (): void => {
    this.ngZone.run(() => {
      this.selectedBrewery = null;
    });
  };

  @HostListener('document:keydown.escape')
  closeBreweryPopupOnEscape(): void {
    this.closeBreweryPopup();
  }

  private readonly updateBreweryPopupPosition = (): void => {
    if (this.selectedBrewery) {
      this.positionBreweryPopup(this.selectedBrewery);
    }
  };

  private positionBreweryPopup(location: BreweryLocation): void {
    if (!this.map || location.latitude === null || location.longitude === null) {
      return;
    }

    const point = this.map.latLngToContainerPoint([location.latitude, location.longitude]);
    const mapSize = this.map.getSize();
    const popupWidth = Math.min(340, mapSize.x - 24);
    const estimatedHeight = Math.min(340, mapSize.y * 0.65);
    const left = Math.max(popupWidth / 2 + 12, Math.min(point.x, mapSize.x - popupWidth / 2 - 12));
    const below = point.y < estimatedHeight + 32;
    const top = below
      ? Math.min(mapSize.y - estimatedHeight - 12, point.y + 22)
      : Math.max(12, point.y - 14);

    this.breweryPopupPosition = { left, top, below };
  }

  private groupBreweries(beers: IndexedBeer[]): BreweryLocation[] {
    const grouped = new Map<string, BreweryLocation>();
    const beersByBrewery = new Map<string, IndexedBeer[]>();
    for (const beer of beers) {
      const breweryKey = beer.Brauerei.trim().toLocaleLowerCase('de');
      const breweryBeers = beersByBrewery.get(breweryKey) ?? [];
      breweryBeers.push(beer);
      beersByBrewery.set(breweryKey, breweryBeers);
    }

    for (const breweryBeers of beersByBrewery.values()) {
      breweryBeers.sort((first, second) =>
        Number(second.Bewertung) - Number(first.Bewertung)
        || first.BierName.localeCompare(second.BierName, 'de')
      );
    }

    for (const beer of beers) {
      const address = beer.Adresse?.trim();
      if (!address) {
        continue;
      }

      const name = beer.Brauerei.trim() || 'Brauerei ohne Namen';
      const key = JSON.stringify([name.toLocaleLowerCase('de'), address.toLocaleLowerCase('de')]);
      const breweryKey = name.toLocaleLowerCase('de');
      const breweryBeers = beersByBrewery.get(breweryKey) ?? [];
      const entry = grouped.get(key) ?? {
        id: `brewery-${grouped.size}`,
        name,
        address,
        beers: breweryBeers,
        latitude: null,
        longitude: null
      };
      grouped.set(key, entry);
    }

    return Array.from(grouped.values());
  }
}
