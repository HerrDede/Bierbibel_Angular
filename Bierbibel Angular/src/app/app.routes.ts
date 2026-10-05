import { Routes } from '@angular/router';
import { AdminComponent } from './admin.component';
import { HomeComponent } from './home.component';
import { ReviewComponent } from './review.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'BierBibel — Bierliste' },
  { path: 'anmeldung', component: ReviewComponent, title: 'BierBibel — Neubewertung' },
  { path: 'admin', component: AdminComponent, title: 'BierBibel — Verwaltung' },
  { path: 'index.html', redirectTo: '', pathMatch: 'full' },
  { path: 'anmeldung.html', redirectTo: 'anmeldung', pathMatch: 'full' },
  { path: 'admin.html', redirectTo: 'admin', pathMatch: 'full' },
  { path: 'backup.html', redirectTo: '', pathMatch: 'full' },
  { path: 'test.html', redirectTo: 'admin', pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
