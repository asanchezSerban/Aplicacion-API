import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Hidrata el estado de autenticación desde las cookies al arrancar la app.
    // Guards y componentes ven isLoggedIn() correcto desde el primer render.
    provideAppInitializer(() => inject(AuthService).initializeAuth())
  ]
};
