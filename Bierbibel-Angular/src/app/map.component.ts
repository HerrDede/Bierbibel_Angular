import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, PLATFORM_ID, ViewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { BeerService, BreweryMapEntry, BreweryMapResponse } from './beer.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map') private mapElement?: ElementRef<HTMLDivElement>;

  private readonly beerService = inject(BeerService);
  private readonly platformId = inject(PLATFORM_ID);
  private leaflet?: typeof import('leaflet');
  private map?: Leaflet.Map;
  private markers?: Leaflet.FeatureGroup;
  private destroyed = false;

  breweries: BreweryMapEntry[] = [];
  locatedCount = 0;
  missingCount = 0;
  loading = false;
  errorMessage = '';
  mapErrorMessage = '';

  get unlocatedBreweries(): BreweryMapEntry[] {
    return this.breweries.filter((brewery) => brewery.latitude === null);
  }

  constructor() {
    this.loadLocations();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.initializeMap();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.remove();
  }

  loadLocations(): void {
    this.loading = true;
    this.errorMessage = '';
    this.beerService.loadBreweryLocations().subscribe({
      next: (response: BreweryMapResponse) => {
        this.breweries = response.breweries;
        this.locatedCount = response.locatedCount;
        this.missingCount = response.missingCount;
        this.loading = false;
        this.renderMarkers();
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = error instanceof Error
          ? error.message
          : 'Die Brauereistandorte konnten nicht geladen werden.';
      }
    });
  }

  private async initializeMap(): Promise<void> {
    if (!this.mapElement) {
      return;
    }

    try {
      const leaflet = await import('leaflet');
      if (this.destroyed || !this.mapElement) {
        return;
      }

      this.leaflet = leaflet;
      this.map = leaflet.map(this.mapElement.nativeElement, {
        scrollWheelZoom: false
      }).setView([49.5, 11.5], 7);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Geocoding by <a href="https://www.geoapify.com/">Geoapify</a>'
      }).addTo(this.map);
      this.markers = leaflet.featureGroup().addTo(this.map);
      this.renderMarkers();
    } catch (error: unknown) {
      console.error('The brewery map could not be initialized.', error);
      this.mapErrorMessage = 'Die Karte konnte nicht initialisiert werden.';
    }
  }

  private renderMarkers(): void {
    if (!this.leaflet || !this.map || !this.markers) {
      return;
    }

    this.markers.clearLayers();
    for (const brewery of this.breweries) {
      if (brewery.latitude === null || brewery.longitude === null) {
        continue;
      }

      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = brewery.name;
      popup.append(title);

      if (brewery.address) {
        const address = document.createElement('p');
        address.textContent = brewery.address;
        popup.append(address);
      }

      const count = document.createElement('p');
      count.textContent = `${brewery.beerCount} ${brewery.beerCount === 1 ? 'Bier' : 'Biere'} in der Liste`;
      popup.append(count);

      this.leaflet.circleMarker([brewery.latitude, brewery.longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: '#c95b16',
        fillOpacity: 0.9
      }).bindPopup(popup).addTo(this.markers);
    }

    const bounds = this.markers.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds.pad(0.15), { maxZoom: 12 });
    }
  }
}
