import { Component, inject, computed } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar';
import { SidebarComponent } from './components/sidebar/sidebar';
import { AuthService } from './services/auth.service';

const FULLSCREEN_ROUTES = [
  '/login', '/mfa-verificar', '/recuperar-password', '/reset-password', '/configurar-totp'
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  styles: [`
    :host {
      font-family: 'Inter', system-ui, sans-serif;
    }
    .admin-shell {
      display: flex;
      min-height: 100vh;
    }
    .admin-content {
      flex: 1;
      min-width: 0;
    }
  `],
  template: `
    @if (isFullscreen()) {
      <router-outlet />
    } @else if (isSuperAdmin()) {
      <div class="admin-shell">
        <app-sidebar />
        <main class="admin-content">
          <router-outlet />
        </main>
      </div>
    } @else {
      <app-navbar />
      <router-outlet />
    }
  `
})
export class App {
  private readonly router      = inject(Router);
  private readonly authService = inject(AuthService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly isFullscreen = computed(() =>
    FULLSCREEN_ROUTES.some(p => this.currentUrl().startsWith(p))
  );

  readonly isSuperAdmin = computed(() =>
    this.authService.isLoggedIn() && this.authService.userRole() === 'SuperAdmin'
  );
}
