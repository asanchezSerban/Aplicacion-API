import { Component, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <nav class="sidebar" [class.sidebar--expanded]="expanded()">

      <!-- Brand -->
      <div class="sidebar-brand">
        <div class="brand-mark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7.5L12 3L20 7.5V16.5L12 21L4 16.5V7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 12L20 7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 12V21" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 12L4 7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
        @if (expanded()) {
          <span class="brand-name">ClientManager</span>
        }
      </div>

      <!-- Nav items -->
      <ul class="nav-list">

        <!-- Toggle (primer item de la lista) -->
        <li>
          <button class="nav-item nav-toggle" type="button"
                  (click)="expanded.update(v => !v)"
                  [attr.aria-label]="expanded() ? 'Colapsar menú' : 'Expandir menú'"
                  [matTooltip]="'Expandir'"
                  [matTooltipDisabled]="expanded()"
                  matTooltipPosition="right">
            <mat-icon class="toggle-icon">chevron_right</mat-icon>
            <span class="nav-label">Minimizar</span>
          </button>
        </li>

        <li class="nav-divider"></li>

        <li>
          <a class="nav-item"
             [routerLink]="ROUTES.COMPANIES"
             routerLinkActive="nav-item--active"
             [routerLinkActiveOptions]="{exact: false}"
             [matTooltip]="'Empresas'"
             [matTooltipDisabled]="expanded()"
             matTooltipPosition="right">
            <mat-icon>domain</mat-icon>
            <span class="nav-label">Empresas</span>
          </a>
        </li>
        <li>
          <a class="nav-item"
             [routerLink]="ROUTES.USERS"
             routerLinkActive="nav-item--active"
             [routerLinkActiveOptions]="{exact: false}"
             [matTooltip]="'Usuarios'"
             [matTooltipDisabled]="expanded()"
             matTooltipPosition="right">
            <mat-icon>people</mat-icon>
            <span class="nav-label">Usuarios</span>
          </a>
        </li>
      </ul>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="user-row"
             [matTooltip]="authService.userEmail() ?? ''"
             [matTooltipDisabled]="expanded()"
             matTooltipPosition="right">
          <div class="avatar">{{ userInitials() }}</div>
          @if (expanded()) {
            <span class="user-email">{{ authService.userEmail() }}</span>
          }
        </div>

        <div class="footer-actions">
          <button class="icon-btn" type="button"
                  (click)="toggleDarkMode()"
                  [attr.aria-label]="isDarkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                  [matTooltip]="isDarkMode() ? 'Modo claro' : 'Modo oscuro'"
                  matTooltipPosition="right">
            <mat-icon>{{ isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <button class="icon-btn icon-btn--danger" type="button"
                  (click)="authService.logout()"
                  aria-label="Cerrar sesión"
                  matTooltip="Cerrar sesión"
                  matTooltipPosition="right">
            <mat-icon>logout</mat-icon>
          </button>
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
      width: 64px;
      height: 100vh;
      position: sticky;
      top: 0;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: #0B0F1A;
      border-right: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
      transition: width 250ms cubic-bezier(0.32, 0.72, 0, 1);
      z-index: 100;
    }

    .sidebar--expanded { width: 240px; }

    /* ── Brand ─────────────────────────────────────────────────── */

    .sidebar-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      padding: 1rem 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .sidebar--expanded .sidebar-brand {
      justify-content: flex-start;
    }

    .brand-mark {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      color: #fff;
    }

    .brand-name {
      font-weight: 600;
      font-size: 0.9375rem;
      letter-spacing: -0.01em;
      color: #fff;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 180ms ease;
    }

    .sidebar--expanded .brand-name { opacity: 1; }

    /* ── Nav ───────────────────────────────────────────────────── */

    .nav-list {
      list-style: none;
      padding: 0.5rem 0.625rem;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      flex: 1;
    }

    .nav-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 0.25rem 0.375rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0 0.75rem;
      height: 40px;
      border-radius: 8px;
      text-decoration: none;
      color: rgba(255,255,255,0.5);
      white-space: nowrap;
      overflow: hidden;
      width: 100%;
      transition: background-color 150ms ease, color 150ms ease;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      &:hover {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.85);
      }
    }

    .nav-item--active {
      background: rgba(255,255,255,0.08);
      color: #fff;
    }

    /* Toggle button */
    .nav-toggle {
      border: none;
      cursor: pointer;
      background: transparent;
      color: rgba(255,255,255,0.3);

      &:hover {
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.6);
      }
    }

    .toggle-icon {
      transition: transform 250ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .sidebar--expanded .toggle-icon {
      transform: rotate(180deg);
    }

    .nav-label {
      font-size: 0.875rem;
      font-weight: 500;
      opacity: 0;
      transform: translateX(-4px);
      transition: opacity 200ms ease, transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
    }

    .sidebar--expanded .nav-label {
      opacity: 1;
      transform: translateX(0);
    }

    /* ── Footer ────────────────────────────────────────────────── */

    .sidebar-footer {
      padding: 0.75rem 0 1rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .sidebar--expanded .sidebar-footer {
      align-items: stretch;
      padding: 0.75rem 0.625rem 1rem;
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.375rem 0.375rem;
      border-radius: 8px;
      cursor: default;
      overflow: hidden;
      min-height: 40px;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(79, 70, 229, 0.4);
      border: 1px solid rgba(79, 70, 229, 0.6);
      color: #A5B4FC;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .user-email {
      font-size: 0.8125rem;
      color: rgba(255,255,255,0.6);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .footer-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .sidebar--expanded .footer-actions {
      align-items: flex-start;
      padding-left: 0.375rem;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      border: none;
      background: transparent;
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background-color 150ms ease, color 150ms ease;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &:hover {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.85);
      }
    }

    .icon-btn--danger:hover {
      background: rgba(220, 38, 38, 0.12);
      color: #FCA5A5;
    }

    @media (prefers-reduced-motion: reduce) {
      .sidebar, .toggle-icon, .nav-label, .brand-name, .user-email { transition: none; }
    }
  `]
})
export class SidebarComponent {
  protected readonly authService = inject(AuthService);
  protected readonly ROUTES = ROUTES;

  expanded   = signal(false);
  isDarkMode = signal(false);

  readonly userInitials = computed(() => {
    const email = this.authService.userEmail() ?? '';
    return email.split('@')[0].slice(0, 2).toUpperCase();
  });

  toggleDarkMode(): void {
    this.isDarkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.isDarkMode());
  }
}
