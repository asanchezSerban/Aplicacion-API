import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ROUTES } from '../../app.routes.constants';

type Theme = 'light' | 'dark' | 'system';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <nav class="sidebar">

      <!-- Brand -->
      <div class="brand">
        <div class="brand-icon">
          <mat-icon>grid_view</mat-icon>
        </div>
      </div>

      <!-- Nav items -->
      <ul class="nav-list">
        <li>
          <a class="nav-item" [routerLink]="ROUTES.COMPANIES"
             routerLinkActive="nav-item--active"
             [routerLinkActiveOptions]="{exact: false}">
            <mat-icon>domain</mat-icon>
            <span>Empresas</span>
          </a>
        </li>
        <li>
          <a class="nav-item" [routerLink]="ROUTES.USERS"
             routerLinkActive="nav-item--active"
             [routerLinkActiveOptions]="{exact: false}">
            <mat-icon>group</mat-icon>
            <span>Usuarios</span>
          </a>
        </li>
      </ul>

      <!-- Footer: Configuración + Help -->
      <div class="sidebar-footer">

        <!-- Configuración con submenu de tema -->
        <div class="config-wrap">
          <button class="nav-item config-btn" type="button"
                  [class.nav-item--active]="isConfigOpen()"
                  (click)="isConfigOpen.update(v => !v)">
            <mat-icon>settings</mat-icon>
            <span>Configuración</span>
            <mat-icon class="config-chevron" [class.config-chevron--open]="isConfigOpen()">
              expand_more
            </mat-icon>
          </button>

          @if (isConfigOpen()) {
            <div class="theme-menu">
              <button class="theme-option" type="button"
                      [class.theme-option--active]="theme() === 'light'"
                      (click)="setTheme('light')">
                <mat-icon>light_mode</mat-icon>
                <span>Luminoso</span>
                @if (theme() === 'light') { <mat-icon class="theme-check">check</mat-icon> }
              </button>
              <button class="theme-option" type="button"
                      [class.theme-option--active]="theme() === 'dark'"
                      (click)="setTheme('dark')">
                <mat-icon>dark_mode</mat-icon>
                <span>Oscuro</span>
                @if (theme() === 'dark') { <mat-icon class="theme-check">check</mat-icon> }
              </button>
              <button class="theme-option theme-option--disabled" type="button" disabled>
                <mat-icon>computer</mat-icon>
                <span>Sistema</span>
                <span class="theme-soon">Próx.</span>
              </button>
            </div>
          }
        </div>

        <!-- Help section -->
        <div class="help-section">
          <mat-icon class="help-icon">help_outline</mat-icon>
          <strong class="help-title">¿Necesitas ayuda?</strong>
          <p class="help-desc">Consulta nuestra documentación</p>
          <a class="help-link" href="#" (click)="$event.preventDefault()">
            Ver documentación →
          </a>
        </div>

      </div>

    </nav>
  `,
  styles: [`
    :host {
      display: contents;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .sidebar {
      width: 220px;
      height: 100vh;
      position: sticky;
      top: 0;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-right: 1px solid #E8EAED;
      overflow: hidden;
    }

    /* ── Brand ─────────────────────────────────────────────────── */

    .brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0 1.25rem;
      height: 60px;
      flex-shrink: 0;
      border-bottom: 1px solid #E8EAED;
    }

    .brand-icon {
      width: 34px; height: 34px;
      border-radius: 8px;
      background: #4F46E5;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      color: #fff;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    /* ── Nav list ──────────────────────────────────────────────── */

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0.625rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 8px;
      text-decoration: none;
      color: #374151;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 150ms ease, color 150ms ease;
      width: 100%;

      mat-icon {
        font-size: 20px; width: 20px; height: 20px;
        color: #6B7280;
        flex-shrink: 0;
        transition: color 150ms ease;
      }

      &:hover {
        background: #F3F4F6;
        color: #111827;
        mat-icon { color: #374151; }
      }
    }

    .nav-item--active {
      background: #EEF2FF;
      color: #4F46E5;
      font-weight: 600;
      mat-icon { color: #4F46E5; }

      &:hover {
        background: #EEF2FF;
        color: #4F46E5;
        mat-icon { color: #4F46E5; }
      }
    }

    /* ── Sidebar footer ─────────────────────────────────────────── */

    .sidebar-footer {
      padding: 0 0.75rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      border-top: 1px solid #E8EAED;
      padding-top: 0.75rem;
    }

    /* ── Configuración + submenu ────────────────────────────────── */

    .config-wrap { position: relative; }

    .config-btn {
      border: none;
      cursor: pointer;
      background: transparent;
      width: 100%;
    }

    .config-chevron {
      font-size: 16px; width: 16px; height: 16px;
      margin-left: auto;
      color: #6B7280 !important;
      transition: transform 200ms ease;
    }

    .config-chevron--open { transform: rotate(180deg); }

    .theme-menu {
      margin-top: 0.25rem;
      background: #F9FAFB;
      border: 1px solid #E8EAED;
      border-radius: 8px;
      overflow: hidden;
    }

    .theme-option {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: background-color 150ms ease;

      mat-icon { font-size: 17px; width: 17px; height: 17px; color: #6B7280; }

      &:hover { background: #F3F4F6; }

      &--active {
        color: #4F46E5;
        mat-icon { color: #4F46E5; }
      }

      &--disabled {
        opacity: 0.45;
        cursor: not-allowed;
        &:hover { background: transparent; }
      }
    }

    .theme-check {
      margin-left: auto;
      font-size: 15px !important;
      width: 15px !important;
      height: 15px !important;
      color: #4F46E5 !important;
    }

    .theme-soon {
      margin-left: auto;
      font-size: 0.625rem;
      background: #E8EAED;
      color: #6B7280;
      border-radius: 4px;
      padding: 0 5px;
      height: 16px;
      display: inline-flex;
      align-items: center;
    }

    /* ── Help section ──────────────────────────────────────────── */

    .help-section {
      padding: 0.875rem;
      border-radius: 10px;
      background: #F9FAFB;
      border: 1px solid #E8EAED;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .help-icon {
      font-size: 20px; width: 20px; height: 20px;
      color: #6B7280;
      margin-bottom: 0.125rem;
    }

    .help-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: #111827;
      display: block;
    }

    .help-desc {
      font-size: 0.75rem;
      color: #6B7280;
      margin: 0;
      line-height: 1.4;
    }

    .help-link {
      font-size: 0.75rem;
      font-weight: 600;
      color: #4F46E5;
      text-decoration: none;
      margin-top: 0.125rem;
      display: inline-block;
      &:hover { text-decoration: underline; }
    }

    /* ── Dark mode ─────────────────────────────────────────────── */

    :host-context(body.dark-mode) .sidebar {
      background: #0B0F1A;
      border-right-color: rgba(255,255,255,0.06);
    }

    :host-context(body.dark-mode) .brand { border-bottom-color: rgba(255,255,255,0.06); }

    :host-context(body.dark-mode) .nav-item {
      color: rgba(255,255,255,0.6);
      mat-icon { color: rgba(255,255,255,0.4); }
      &:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); mat-icon { color: rgba(255,255,255,0.7); } }
    }

    :host-context(body.dark-mode) .nav-item--active {
      background: rgba(79,70,229,0.2);
      color: #A5B4FC;
      mat-icon { color: #A5B4FC; }
      &:hover { background: rgba(79,70,229,0.2); color: #A5B4FC; }
    }

    :host-context(body.dark-mode) .sidebar-footer { border-top-color: rgba(255,255,255,0.06); }

    :host-context(body.dark-mode) .theme-menu {
      background: #131826;
      border-color: rgba(255,255,255,0.08);
    }

    :host-context(body.dark-mode) .theme-option {
      color: rgba(255,255,255,0.6);
      mat-icon { color: rgba(255,255,255,0.4); }
      &:hover { background: rgba(255,255,255,0.06); }
      &--active { color: #A5B4FC; mat-icon { color: #A5B4FC; } }
    }

    :host-context(body.dark-mode) .theme-soon { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.4); }

    :host-context(body.dark-mode) .help-section {
      background: rgba(255,255,255,0.04);
      border-color: rgba(255,255,255,0.06);
    }

    :host-context(body.dark-mode) .help-title { color: rgba(255,255,255,0.8); }
    :host-context(body.dark-mode) .help-desc  { color: rgba(255,255,255,0.35); }
    :host-context(body.dark-mode) .help-link  { color: #818CF8; }

    /* ── Mobile ─────────────────────────────────────────────────── */

    @media (max-width: 1024px) {
      .sidebar { display: none; }
    }
  `]
})
export class SidebarComponent {
  protected readonly ROUTES = ROUTES;

  isConfigOpen = signal(false);
  theme        = signal<Theme>('light');

  setTheme(t: Theme): void {
    this.theme.set(t);
    this.isConfigOpen.set(false);
    document.body.classList.toggle('dark-mode', t === 'dark');
  }
}
