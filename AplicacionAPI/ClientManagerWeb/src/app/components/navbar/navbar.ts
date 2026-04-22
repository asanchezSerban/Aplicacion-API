import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="brand-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7.5L12 3L20 7.5V16.5L12 21L4 16.5V7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 12L20 7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 12V21" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M12 12L4 7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="brand-name">ClientManager</span>
      </div>

      <div class="topbar-actions">
        <span class="user-email" [matTooltip]="authService.userRole() ?? ''">
          {{ authService.userEmail() }}
        </span>

        <button class="icon-btn" type="button"
                (click)="toggleDarkMode()"
                [attr.aria-label]="isDarkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
                [matTooltip]="isDarkMode() ? 'Modo claro' : 'Modo oscuro'">
          <mat-icon>{{ isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <button class="icon-btn icon-btn--danger" type="button"
                (click)="authService.logout()"
                aria-label="Cerrar sesión"
                matTooltip="Cerrar sesión">
          <mat-icon>logout</mat-icon>
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host {
      --ink-900: #0B0F1A;
      --ink-500: #4B5468;
      --ink-200: #C3C9D6;
      --ink-100: #E6E9F0;
      --ink-50:  #F5F6FA;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 48px;
      padding: 0 1.25rem;
      background: #fff;
      border-bottom: 1px solid var(--ink-100);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .topbar-brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .brand-mark {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: #0B0F1A;
      display: grid;
      place-items: center;
      color: #fff;
    }

    .brand-name {
      font-size: 0.9375rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--ink-900);
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .user-email {
      font-size: 0.8125rem;
      color: var(--ink-500);
      padding: 0 0.5rem;
      cursor: default;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      border: 1px solid var(--ink-100);
      background: transparent;
      color: var(--ink-500);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background-color 150ms ease, color 150ms ease;

      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
      }

      &:hover {
        background: var(--ink-50);
        color: var(--ink-900);
      }
    }

    .icon-btn--danger:hover {
      background: #FEF2F2;
      color: #DC2626;
      border-color: #FECACA;
    }

    :host-context(body.dark-mode) {
      --ink-900: #F5F6FA;
      --ink-500: #8A93A6;
      --ink-200: #1E2638;
      --ink-100: #131826;
      --ink-50:  #0B0F1A;
    }
    :host-context(body.dark-mode) .topbar {
      background: #0B0F1A;
    }
    :host-context(body.dark-mode) .brand-mark {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
    }
    :host-context(body.dark-mode) .icon-btn--danger:hover {
      background: rgba(220, 38, 38, 0.12);
      color: #FCA5A5;
      border-color: rgba(220, 38, 38, 0.3);
    }
  `]
})
export class NavbarComponent {
  protected readonly authService = inject(AuthService);

  isDarkMode = signal(false);

  toggleDarkMode(): void {
    this.isDarkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.isDarkMode());
  }
}
