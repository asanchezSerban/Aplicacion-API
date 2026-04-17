import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, from, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Estado compartido entre todas las peticiones — un único candado global.
let isRefreshing = false;
const refreshResult$ = new BehaviorSubject<boolean | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Adjuntar credenciales (cookies) a todas las peticiones al backend.
  // El browser envía automáticamente accessToken y refreshToken si están presentes.
  const reqWithCreds = req.clone({ withCredentials: true });

  return next(reqWithCreds).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si no es 401 o es un endpoint de auth (login, refresh...), propagar tal cual
      if (error.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        // Otra petición ya está renovando el token — esperar a que termine
        return refreshResult$.pipe(
          filter(result => result !== null),
          take(1),
          switchMap(success =>
            success ? next(reqWithCreds) : throwError(() => error)
          )
        );
      }

      // Somos la primera petición en fallar con 401 — tomar el control del refresh
      isRefreshing = true;
      refreshResult$.next(null);  // resetear el tablón antes de empezar

      return from(authService.refresh()).pipe(
        switchMap(success => {
          isRefreshing = false;
          refreshResult$.next(success);
          // Si el refresh fue exitoso, el servidor ya emitió nuevas cookies —
          // reintentar la petición original (el browser enviará las cookies nuevas)
          return success ? next(reqWithCreds) : throwError(() => error);
        }),
        catchError(err => {
          isRefreshing = false;
          refreshResult$.next(false);
          return throwError(() => err);
        })
      );
    })
  );
};

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login')
      || url.includes('/auth/refresh')
      || url.includes('/auth/me')           // fallo en init → no reintentar
      || url.includes('/auth/mfa-verify')
      || url.includes('/auth/forgot-password')
      || url.includes('/auth/reset-password');
}
