import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const requestWithToken = addToken(req, authService.getToken());

  return next(requestWithToken).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si no es 401 o es la propia petición de refresh/login, no reintentamos
      if (error.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => error);
      }

      // Token expirado → intentamos renovar
      return from(authService.refresh()).pipe(
        switchMap(newToken => {
          if (!newToken) return throwError(() => error);
          return next(addToken(req, newToken));
        })
      );
    })
  );
};

function addToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login')
      || url.includes('/auth/refresh')
      || url.includes('/auth/mfa-verify')
      || url.includes('/auth/forgot-password')
      || url.includes('/auth/reset-password');
}
