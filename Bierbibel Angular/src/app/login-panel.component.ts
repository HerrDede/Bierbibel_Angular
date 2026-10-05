import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-card login-card">
      <p class="eyebrow">Geschützter Bereich</p>
      <h1>Bitte anmelden</h1>
      <p class="page-description">Melde dich an, um diese BierBibel-Funktion zu verwenden.</p>
      <p *ngIf="checking" class="status-message" role="status">Anmeldestatus wird geprüft …</p>
      <p *ngIf="authenticated" class="status-message success-message" role="status">Du bist angemeldet.</p>
      <form *ngIf="!checking && !authenticated" (ngSubmit)="login()" #loginForm="ngForm">
        <label for="admin-password">Passwort</label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autocomplete="current-password"
          [(ngModel)]="password"
          required
        >
        <button class="button button-gold" type="submit" [disabled]="loginForm.invalid || submitting">
          {{ submitting ? 'Wird angemeldet …' : 'Anmelden' }}
        </button>
      </form>
      <p *ngIf="errorMessage" class="status-message error-message" role="alert">{{ errorMessage }}</p>
    </section>
  `
})
export class LoginPanelComponent implements OnInit {
  private readonly auth = inject(AuthService);

  @Output() readonly authenticatedChange = new EventEmitter<boolean>();

  checking = true;
  authenticated = false;
  submitting = false;
  password = '';
  errorMessage = '';

  ngOnInit(): void {
    this.auth.checkSession().subscribe({
      next: (authenticated) => {
        this.checking = false;
        this.authenticated = authenticated;
        this.authenticatedChange.emit(authenticated);
      },
      error: (error: unknown) => {
        this.checking = false;
        this.authenticatedChange.emit(false);
        this.errorMessage = this.errorText('Der Anmeldestatus konnte nicht geprüft werden.', error);
      }
    });
  }

  login(): void {
    if (this.submitting || !this.password.trim()) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.auth.login(this.password).subscribe({
      next: () => {
        this.submitting = false;
        this.authenticated = true;
        this.password = '';
        this.authenticatedChange.emit(true);
      },
      error: (error: unknown) => {
        this.submitting = false;
        this.errorMessage = this.errorText('Anmeldung fehlgeschlagen.', error);
      }
    });
  }

  private errorText(message: string, error: unknown): string {
    return error instanceof Error ? error.message : message;
  }
}
