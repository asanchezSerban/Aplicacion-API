import { Component, inject, computed, signal, effect } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from './components/navbar/navbar';
import { SidebarComponent } from './components/sidebar/sidebar';
import { AuthService } from './services/auth.service';
import { NotificationService, StoredNotif } from './services/notification.service';
import { ROUTES } from './app.routes.constants';

interface AppNotif extends StoredNotif {
  timeAgo: string;
}

const FULLSCREEN_ROUTES = [
  '/login', '/mfa-verificar', '/recuperar-password', '/reset-password', '/configurar-totp', '/not-found'
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
      height: 100vh;
      background: #F5F6FA;
      overflow: hidden;
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
      transition: transform 200ms ease;
      &--open { transform: rotate(180deg); }
    }

    /* ── Header dropdowns ──────────────────────────────────────── */

    .header-dropdown { position: relative; }

    .hd-backdrop {
      position: fixed;
      inset: 0;
      z-index: 200;
    }

    .hd-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      background: #fff;
      border: 1px solid #E6E9F0;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
      z-index: 201;
      overflow: hidden;
      animation: dropIn 150ms cubic-bezier(0.22,1,0.36,1) both;

      &--notif { width: 320px; }
      &--user  { width: 200px; }
    }

    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .hd-panel-header {
      padding: 0.875rem 1rem 0.625rem;
      border-bottom: 1px solid #E6E9F0;
    }

    .hd-panel-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #0B0F1A;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .hd-empty {
      padding: 1.25rem 1rem;
      font-size: 0.8125rem;
      color: #8A93A6;
      font-family: 'Inter', system-ui, sans-serif;
      text-align: center;
    }

    /* Notificaciones */
    .notif-list {
      list-style: none;
      margin: 0;
      padding: 0.375rem 0;
    }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      transition: background-color 100ms ease;
      cursor: default;
      &:hover { background: #F5F6FA; }
    }

    .notif-icon {
      width: 32px; height: 32px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .notif-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .notif-text {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0B0F1A;
      font-family: 'Inter', system-ui, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .notif-sub {
      font-size: 0.75rem;
      color: #8A93A6;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .notif-time {
      font-size: 0.6875rem;
      color: #8A93A6;
      font-family: 'Inter', system-ui, sans-serif;
      flex-shrink: 0;
      margin-top: 2px;
    }

    /* Menú usuario */
    .hd-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.625rem 1rem;
      border: none;
      background: transparent;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1E2638;
      cursor: pointer;
      text-align: left;
      transition: background-color 150ms ease;

      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #4B5468; }
      &:hover { background: #F5F6FA; }

      &--danger {
        color: #DC2626;
        mat-icon { color: #DC2626; }
        &:hover { background: #FEF2F2; }
      }
    }

    .hd-divider {
      height: 1px;
      background: #E6E9F0;
      margin: 0.25rem 0;
    }

    /* Dark mode dropdowns */
    body.dark-mode .hd-panel {
      background: #131826;
      border-color: #1E2638;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    }
    body.dark-mode .hd-panel-header { border-bottom-color: #1E2638; }
    body.dark-mode .hd-panel-title  { color: #F5F6FA; }
    body.dark-mode .notif-item:hover { background: #0B0F1A; }
    body.dark-mode .notif-text { color: #F5F6FA; }
    body.dark-mode .hd-item { color: #C3C9D6; mat-icon { color: #8A93A6; } }
    body.dark-mode .hd-item:hover { background: #0B0F1A; }
    body.dark-mode .hd-divider { background: #1E2638; }
    body.dark-mode .hd-item--danger { color: #FCA5A5; mat-icon { color: #FCA5A5; } }
    body.dark-mode .hd-item--danger:hover { background: rgba(220,38,38,0.12); }

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

    :host-context(body.dark-mode) .admin-shell    { background: #0B0F1A; }
    :host-context(body.dark-mode) .admin-content  { background: #0B0F1A; }
    :host-context(body.dark-mode) .content-header { background: #0B0F1A; }
    :host-context(body.dark-mode) .topbar-notif   { border-color: #1E2638; color: #8A93A6; }
    :host-context(body.dark-mode) .topbar-notif:hover { background: #131826; }
    :host-context(body.dark-mode) .notif-badge    { border-color: #0B0F1A; }
    :host-context(body.dark-mode) .topbar-sep     { background: #1E2638; }
    :host-context(body.dark-mode) .topbar-user:hover { background: #131826; }
    :host-context(body.dark-mode) .topbar-name    { color: #F5F6FA; }
    :host-context(body.dark-mode) .topbar-role    { color: #4B5468; }
    :host-context(body.dark-mode) .topbar-avatar  { background: rgba(79,70,229,0.35); }

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

      :host-context(body.dark-mode) .mobile-nav-bar { background: #131826; border-bottom-color: #1E2638; }
      :host-context(body.dark-mode) .mobile-nav-item { color: rgba(255,255,255,0.6); }
      :host-context(body.dark-mode) .mobile-nav-item.active { background: rgba(79,70,229,0.2); color: #A5B4FC; }
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
          <!-- Header: campana + usuario -->
          <header class="content-header">

            <!-- Notificaciones -->
            <div class="header-dropdown">
              <button class="topbar-notif" type="button" aria-label="Notificaciones"
                      (click)="openNotif()">
                <mat-icon>notifications</mat-icon>
                @if (unreadCount() > 0) {
                  <span class="notif-badge">{{ unreadCount() }}</span>
                }
              </button>

              @if (isNotifOpen()) {
                <div class="hd-backdrop" (click)="closeDropdowns()"></div>
                <div class="hd-panel hd-panel--notif">
                  <div class="hd-panel-header">
                    <span class="hd-panel-title">Actividad reciente</span>
                  </div>
                  @if (notifications().length === 0) {
                    <p class="hd-empty">Sin actividad reciente.</p>
                  } @else {
                    <ul class="notif-list">
                      @for (n of notifications(); track n.date) {
                        <li class="notif-item">
                          <div class="notif-icon" [style.background]="n.iconColor + '18'">
                            <mat-icon [style.color]="n.iconColor">{{ n.icon }}</mat-icon>
                          </div>
                          <div class="notif-body">
                            <span class="notif-text">{{ n.text }}</span>
                            <span class="notif-sub">{{ n.sub }}</span>
                          </div>
                          <span class="notif-time">{{ n.timeAgo }}</span>
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>

            <div class="topbar-sep"></div>

            <!-- Menú de usuario -->
            <div class="header-dropdown">
              <div class="topbar-user" role="button" tabindex="0"
                   (click)="openUserMenu()"
                   (keydown.enter)="openUserMenu()">
                <div class="topbar-avatar">{{ userInitials() }}</div>
                <div class="topbar-user-info">
                  <span class="topbar-name">{{ displayName() }}</span>
                  <span class="topbar-role">Administrador</span>
                </div>
                <mat-icon class="topbar-chevron"
                          [class.topbar-chevron--open]="isUserMenuOpen()">
                  expand_more
                </mat-icon>
              </div>

              @if (isUserMenuOpen()) {
                <div class="hd-backdrop" (click)="closeDropdowns()"></div>
                <div class="hd-panel hd-panel--user">
                  <button class="hd-item" type="button" (click)="goToAccount()">
                    <mat-icon>manage_accounts</mat-icon>
                    <span>Mi cuenta</span>
                  </button>
                  <div class="hd-divider"></div>
                  <button class="hd-item hd-item--danger" type="button" (click)="logout()">
                    <mat-icon>logout</mat-icon>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              }
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
  private readonly router              = inject(Router);
  protected readonly authService       = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  protected readonly ROUTES            = ROUTES;

  isUserMenuOpen  = signal(false);
  isNotifOpen     = signal(false);
  notifications   = signal<AppNotif[]>([]);
  unreadCount     = signal(0);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => {
        this.unreadCount.set(this.notificationService.getUnreadCount());
        return (e as NavigationEnd).urlAfterRedirects;
      })
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

  readonly notifCount = computed(() => this.notifications().length);

  private loadNotifications(): void {
    const items = this.notificationService.getAll().map(n => ({
      ...n,
      timeAgo: this.timeAgo(n.date)
    }));
    this.notifications.set(items);
  }

  openNotif(): void {
    const opening = !this.isNotifOpen();
    this.isNotifOpen.set(opening);
    this.isUserMenuOpen.set(false);
    if (opening) {
      this.loadNotifications();
    } else {
      this.notificationService.markAsSeen();
      this.unreadCount.set(0);
    }
  }

  openUserMenu(): void {
    this.isUserMenuOpen.update(v => !v);
    this.isNotifOpen.set(false);
  }

  closeDropdowns(): void {
    if (this.isNotifOpen()) {
      this.notificationService.markAsSeen();
      this.unreadCount.set(0);
    }
    this.isNotifOpen.set(false);
    this.isUserMenuOpen.set(false);
  }

  goToAccount(): void {
    this.closeDropdowns();
    this.router.navigate([ROUTES.CONFIGURAR_TOTP]);
  }

  logout(): void {
    this.closeDropdowns();
    this.authService.logout();
  }

  private timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30) return `Hace ${days}d`;
    const months = Math.floor(days / 30);
    return `Hace ${months}m`;
  }
}
