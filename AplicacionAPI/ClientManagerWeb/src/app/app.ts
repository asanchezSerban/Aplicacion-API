import { Component, inject, computed, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from './components/navbar/navbar';
import { SidebarComponent } from './components/sidebar/sidebar';
import { AuthService } from './services/auth.service';
import { ROUTES } from './app.routes.constants';

const FULLSCREEN_ROUTES = [
  '/login', '/mfa-verificar', '/recuperar-password', '/reset-password', '/configurar-totp'
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NavbarComponent, SidebarComponent, MatIconModule, MatTooltipModule],
  styles: [`
    :host { font-family: 'Inter', system-ui, sans-serif; }

    /* ── Admin shell: sidebar + content side by side ─────────── */

    .admin-shell {
      display: flex;
      flex-direction: row;
      min-height: 100vh;
      background: #F5F6FA;
    }

    /* ── Bell + user: flotando en esquina superior derecha ───── */

    .content-header {
      position: absolute;
      top: 0;
      right: 0;
      height: 60px;
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0 1.75rem;
      z-index: 10;
      pointer-events: auto;
    }

    .topbar-notif {
      position: relative;
      width: 34px; height: 34px;
      border-radius: 8px;
      border: 1px solid #E6E9F0;
      background: transparent;
      color: #4B5468;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background-color 150ms ease;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &:hover { background: #F5F6FA; }
    }

    .notif-badge {
      position: absolute;
      top: -5px; right: -5px;
      min-width: 17px; height: 17px;
      border-radius: 9px;
      padding: 0 4px;
      background: #E11D48;
      color: #fff;
      font-size: 0.5625rem;
      font-weight: 700;
      display: grid;
      place-items: center;
      border: 2px solid #fff;
    }

    .topbar-sep {
      width: 1px; height: 22px;
      background: #E6E9F0;
    }

    .topbar-user {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.3rem 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 150ms ease;
      &:hover { background: #F5F6FA; }
    }

    .topbar-avatar {
      width: 30px; height: 30px;
      border-radius: 6px;
      background: #4F46E5;
      color: #fff;
      font-size: 0.6875rem;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .topbar-user-info {
      display: flex;
      flex-direction: column;
      gap: 0;
      line-height: 1.2;
    }

    .topbar-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0B0F1A;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .topbar-role {
      font-size: 0.6875rem;
      color: #8A93A6;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .topbar-chevron {
      font-size: 16px; width: 16px; height: 16px;
      color: #8A93A6;
    }

    .admin-content {
      flex: 1;
      min-width: 0;
      position: relative;
      overflow-y: auto;
    }

    /* ── Mobile topbar (only on mobile, replaces sidebar nav) ── */

    .mobile-nav-bar {
      display: none;
    }

    /* ── Dark mode ─────────────────────────────────────────── */

    body.dark-mode .admin-shell    { background: #0B0F1A; }
    body.dark-mode .admin-topbar   { background: #131826; border-bottom-color: #1E2638; }
    body.dark-mode .topbar-notif   { border-color: #1E2638; color: #8A93A6; }
    body.dark-mode .topbar-notif:hover { background: #0B0F1A; }
    body.dark-mode .notif-badge    { border-color: #131826; }
    body.dark-mode .topbar-sep     { background: #1E2638; }
    body.dark-mode .topbar-user:hover { background: #0B0F1A; }
    body.dark-mode .topbar-name    { color: #F5F6FA; }

    /* ── Tablet: sidebar se oculta, nav móvil aparece (1024px) ── */

    @media (max-width: 1024px) {

      .mobile-nav-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        height: 48px;
        background: #fff;
        border-bottom: 1px solid #E6E9F0;
        padding: 0 1rem;
        flex-shrink: 0;
      }

      .mobile-nav-item {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        height: 36px;
        padding: 0 0.875rem;
        border-radius: 8px;
        text-decoration: none;
        font-size: 0.8125rem;
        font-weight: 500;
        color: #4B5468;
        transition: background-color 150ms ease, color 150ms ease;
        font-family: 'Inter', system-ui, sans-serif;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }

        &:hover { background: #F5F6FA; color: #0B0F1A; }
        &.active { background: #EEF0FF; color: #4F46E5; font-weight: 600; }
      }

      body.dark-mode .mobile-nav-bar { background: #131826; border-bottom-color: #1E2638; }
    }

    /* ── Teléfono pequeño (≤640px) ─────────────────────────────── */

    @media (max-width: 640px) {
      /* Reducir content-header: solo campana + avatar, sin texto ni separador */
      .topbar-user-info,
      .topbar-chevron,
      .topbar-sep { display: none; }

      /* Reservar espacio a la derecha para campana (34px) + avatar (30px) + gaps */
      .mobile-nav-bar {
        justify-content: flex-start;
        padding-right: 88px;
      }
    }
  `],
  template: `
    @if (isFullscreen()) {
      <router-outlet />
    } @else if (isSuperAdmin()) {

      <div class="admin-shell">

        <app-sidebar />

        <div class="admin-content">
          <!-- Header: solo bell + usuario, sin brand (el brand está en el sidebar) -->
          <header class="content-header">
            <button class="topbar-notif" type="button" aria-label="Notificaciones">
              <mat-icon>notifications</mat-icon>
              <span class="notif-badge">3</span>
            </button>
            <div class="topbar-sep"></div>
            <div class="topbar-user">
              <div class="topbar-avatar">{{ userInitials() }}</div>
              <div class="topbar-user-info">
                <span class="topbar-name">{{ displayName() }}</span>
                <span class="topbar-role">Administrador</span>
              </div>
              <mat-icon class="topbar-chevron">expand_more</mat-icon>
            </div>
          </header>

          <!-- Mobile nav (< 768px) -->
          <nav class="mobile-nav-bar">
            <a class="mobile-nav-item"
               [routerLink]="ROUTES.COMPANIES"
               routerLinkActive="active"
               [routerLinkActiveOptions]="{exact: false}">
              <mat-icon>domain</mat-icon><span>Empresas</span>
            </a>
            <a class="mobile-nav-item"
               [routerLink]="ROUTES.USERS"
               routerLinkActive="active"
               [routerLinkActiveOptions]="{exact: false}">
              <mat-icon>people</mat-icon><span>Usuarios</span>
            </a>
          </nav>

          <router-outlet />
        </div>

      </div>

    } @else {
      <app-navbar />
      <router-outlet />
    }
  `
})
export class App {
  private readonly router       = inject(Router);
  protected readonly authService = inject(AuthService);
  protected readonly ROUTES      = ROUTES;

  isDarkMode = signal(false);

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

  readonly userInitials = computed(() => {
    const email = this.authService.userEmail() ?? '';
    return email.split('@')[0].slice(0, 2).toUpperCase();
  });

  readonly displayName = computed(() => {
    const email = this.authService.userEmail() ?? '';
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  });

  toggleDarkMode(): void {
    this.isDarkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.isDarkMode());
  }
}
