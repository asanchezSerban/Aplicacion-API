import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ROUTES } from '../../app.routes.constants';

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
        <span class="brand-name">ClientManager</span>
      </div>

      <!-- Nav items -->
      <ul class="nav-list">
        <li>
          <a class="nav-item" routerLink="/dashboard"
             routerLinkActive="nav-item--active">
            <mat-icon>home</mat-icon>
            <span>Dashboard</span>
          </a>
        </li>
        <li>
          <a class="nav-item" [routerLink]="ROUTES.COMPANIES"
             routerLinkActive="nav-item--active"
             [routerLinkActiveOptions]="{exact: false}">
            <mat-icon>grid_view</mat-icon>
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
        <li>
          <a class="nav-item" routerLink="/roles"
             routerLinkActive="nav-item--active">
            <mat-icon>manage_accounts</mat-icon>
            <span>Roles</span>
          </a>
        </li>
        <li>
          <a class="nav-item" routerLink="/configuracion"
             routerLinkActive="nav-item--active">
            <mat-icon>settings</mat-icon>
            <span>Configuración</span>
          </a>
        </li>
        <li>
          <a class="nav-item" routerLink="/auditoria"
             routerLinkActive="nav-item--active">
            <mat-icon>receipt_long</mat-icon>
            <span>Auditoría</span>
          </a>
        </li>
      </ul>

      <!-- Help section -->
      <div class="help-section">
        <mat-icon class="help-icon">help_outline</mat-icon>
        <strong class="help-title">¿Necesitas ayuda?</strong>
        <p class="help-desc">Consulta nuestra documentación</p>
        <a class="help-link" href="#" (click)="$event.preventDefault()">
          Ver documentación →
        </a>
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
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-right: 1px solid #E8EAED;
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

    .brand-name {
      font-size: 1rem;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
    }

    /* ── Nav list ──────────────────────────────────────────────── */

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0.5rem 0.75rem;
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

    /* ── Help section ──────────────────────────────────────────── */

    .help-section {
      margin: 0 0.75rem 1.25rem;
      padding: 1rem;
      border-radius: 10px;
      background: #F9FAFB;
      border: 1px solid #E8EAED;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .help-icon {
      font-size: 22px; width: 22px; height: 22px;
      color: #6B7280;
      margin-bottom: 0.25rem;
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
      margin-top: 0.25rem;
      display: inline-block;

      &:hover { text-decoration: underline; }
    }

    /* ── Mobile ─────────────────────────────────────────────────── */

    @media (max-width: 767px) {
      .sidebar { display: none; }
    }
  `]
})
export class SidebarComponent {
  protected readonly ROUTES = ROUTES;
}
