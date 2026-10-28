import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { BeerService, IndexedBeer } from './beer.service';

interface RatedBeer {
  beer: IndexedBeer;
  score: number;
}

interface ScoreBand {
  label: string;
  count: number;
}

interface AverageEntry {
  name: string;
  average: number;
  count: number;
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.css'
})
export class StatisticsComponent {
  private readonly beerService = inject(BeerService);

  beers: IndexedBeer[] = [];
  loading = false;
  errorMessage = '';

  private readonly scoreBandRanges: ReadonlyArray<{ label: string; min: number; max: number }> = [
    { label: '10–19', min: 10, max: 20 },
    { label: '20–29', min: 20, max: 30 },
    { label: '30–39', min: 30, max: 40 },
    { label: '40–49', min: 40, max: 50 },
    { label: '50–59', min: 50, max: 60 },
    { label: '60–69', min: 60, max: 70 },
    { label: '70–79', min: 70, max: 80 },
    { label: '80–84', min: 80, max: 85 },
    { label: '85–89', min: 85, max: 90 },
    { label: '90–94', min: 90, max: 95 },
    { label: '95+', min: 95, max: Number.POSITIVE_INFINITY }
  ];

  constructor() {
    this.loadBeers();
  }

  get ratedBeers(): RatedBeer[] {
    return this.beers.flatMap((beer) => {
      const rawScore = typeof beer.Bewertung === 'string' ? beer.Bewertung.trim() : beer.Bewertung;
      if (rawScore === '') {
        return [];
      }

      const score = Number(rawScore);
      return Number.isFinite(score) && score >= 10 ? [{ beer, score }] : [];
    });
  }

  get averageScore(): number | null {
    const rated = this.ratedBeers;
    return rated.length
      ? rated.reduce((total, entry) => total + entry.score, 0) / rated.length
      : null;
  }

  get scoreBands(): ScoreBand[] {
    const rated = this.ratedBeers;
    return this.scoreBandRanges.map((range) => ({
      label: range.label,
      count: rated.filter((entry) => entry.score >= range.min && entry.score < range.max).length
    }));
  }

  get categories(): AverageEntry[] {
    return this.sortByCount(this.averagesBy((beer) => beer.Art));
  }

  get breweries(): AverageEntry[] {
    return this.sortByCount(this.averagesBy((beer) => beer.Brauerei)).slice(0, 10);
  }

  get maxScoreBandCount(): number {
    return Math.max(1, ...this.scoreBands.map((band) => band.count));
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
          ? `Die Statistiken konnten nicht geladen werden (HTTP ${error.status}).`
          : error instanceof Error
            ? error.message
            : 'Die Statistiken konnten nicht geladen werden.';
      }
    });
  }

  formatScore(score: number | null): string {
    return score === null
      ? '–'
      : score.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  barWidth(count: number, max: number): string {
    return `${(count / max) * 100}%`;
  }

  private averagesBy(getGroup: (beer: IndexedBeer) => string): AverageEntry[] {
    const groups = new Map<string, { total: number; count: number }>();

    for (const { beer, score } of this.ratedBeers) {
      const name = getGroup(beer).trim() || 'Ohne Angabe';
      const group = groups.get(name) ?? { total: 0, count: 0 };
      group.total += score;
      group.count += 1;
      groups.set(name, group);
    }

    return Array.from(groups, ([name, group]) => ({
      name,
      average: group.total / group.count,
      count: group.count
    }));
  }

  private sortByCount(entries: AverageEntry[]): AverageEntry[] {
    return entries.sort((first, second) =>
      second.count - first.count || second.average - first.average || first.name.localeCompare(second.name, 'de')
    );
  }
}
