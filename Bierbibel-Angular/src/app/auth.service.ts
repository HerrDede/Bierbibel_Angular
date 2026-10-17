import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

function serverError(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'object' && error.error !== null
      && 'error' in error.error && typeof error.error.error === 'string') {
      return new Error(error.error.error);
    }

    return new Error(`Die Serveranfrage ist fehlgeschlagen (HTTP ${error.status}).`);
  }

  return error instanceof Error ? error : new Error('Die Serveranfrage ist fehlgeschlagen.');
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  checkSession(): Observable<boolean> {
    return this.http.get<{ authenticated: boolean }>('/api/auth/session').pipe(
      map((response) => response.authenticated),
      catchError((error: unknown) => throwError(() => serverError(error)))
    );
  }

  login(password: string): Observable<void> {
    return this.http.post('/api/auth/login', { password }).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => serverError(error)))
    );
  }

  logout(): Observable<void> {
    return this.http.post('/api/auth/logout', {}).pipe(
      map(() => undefined),
      catchError((error: unknown) => throwError(() => serverError(error)))
    );
  }
}
