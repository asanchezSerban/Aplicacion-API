import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, from, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Estado compartido entre todas las peticiones — vive fuera del interceptor
// para que sea un único candado global, no uno por petición.
let isRefreshing = false;
const newToken$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(addToken(req, authService.getToken())).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si no es 401 o es una petición de auth (login, refresh...), propagar el error tal cual
      if (error.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        // Otra petición ya está renovando el token — esperar a que termine
        // filter(token => token !== null): ignorar el null inicial del BehaviorSubject
        // take(1): desuscribirse tras recibir el primer token válido
        return newToken$.pipe(
          filter(token => token !== null),
          take(1),
          switchMap(token => next(addToken(req, token!)))
        );
      }

      // Somos la primera petición en fallar — tomamos el control del refresh
      isRefreshing = true;
      newToken$.next(null); // resetear el tablón antes de empezar

      return from(authService.refresh()).pipe(
        switchMap(token => {
          isRefreshing = false;
          if (!token) return throwError(() => error);
          newToken$.next(token); // publicar el nuevo token — las peticiones en espera lo reciben
          return next(addToken(req, token));
        }),
        catchError(err => {
          isRefreshing = false;
          return throwError(() => err);
        })
      );
    })
  );
};

function addToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login')
      || url.includes('/auth/refresh')
      || url.includes('/auth/mfa-verify')
      || url.includes('/auth/forgot-password')
      || url.includes('/auth/reset-password');
}
