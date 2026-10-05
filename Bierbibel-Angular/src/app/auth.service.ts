import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

const SESSION_KEY = 'bierbibel.local-session';
const LOCAL_ACCESS_CODE = 'Doscht';

@Injectable({ providedIn: 'root' })
export class AuthService {
  checkSession(): Observable<boolean> {
    try {
      return of(sessionStorage.getItem(SESSION_KEY) === 'authenticated');
    } catch {
      return throwError(() => new Error('Der Browser-Sitzungsspeicher ist nicht verfügbar.'));
    }
  }

  login(password: string): Observable<void> {
    if (password !== LOCAL_ACCESS_CODE) {
      return throwError(() => new Error('Falsches Passwort.'));
    }

    try {
      sessionStorage.setItem(SESSION_KEY, 'authenticated');
      return of(void 0);
    } catch {
      return throwError(() => new Error('Die Anmeldung konnte nicht in diesem Browser gespeichert werden.'));
    }
  }

  logout(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      throw new Error('Die lokale Sitzung konnte nicht beendet werden.');
    }
  }
}
