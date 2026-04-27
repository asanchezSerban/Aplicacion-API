import { Component, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
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

      <div class="topbar-right">
        <div class="user-chip">
          <div class="user-avatar">{{ initials() }}</div>
          <span class="user-email">{{ authService.userEmail() }}</span>
        </div>

        <button class="icon-btn" type="button"
                (click)="toggleDarkMode()"
                [attr.aria-label]="isDarkMode() ? 'Modo claro' : 'Modo oscuro'">
          <mat-icon>{{ isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <button class="icon-btn icon-btn--danger" type="button"
                (click)="authService.logout()"
                aria-label="Cerrar sesión">
          <mat-icon>logout</mat-icon>
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host {
      --ink-900: #0B0F1A;
      --ink-700: #1E2638;
      --ink-500: #4B5468;
      --ink-200: #C3C9D6;
      --ink-100: #E6E9F0;
      --ink-50:  #F5F6FA;
      --accent:  #4F46E5;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
      padding: 0 1.75rem;
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
      width: 32px; height: 32px;
      border-radius: 8px;
      background: var(--accent);
      display: grid;
      place-items: center;
      color: #fff;
      flex-shrink: 0;
    }

    .brand-name {
      font-size: 0.9375rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink-900);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.75rem 0.25rem 0.25rem;
      border-radius: 20px;
      border: 1px solid var(--ink-100);
      background: var(--ink-50);
    }

    .user-avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: rgba(79,70,229,0.12);
      border: 1px solid rgba(79,70,229,0.2);
      color: var(--accent);
      font-size: 0.625rem;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .user-email {
      font-size: 0.8125rem;
      color: var(--ink-700);
      font-weight: 500;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .icon-btn {
      width: 34px; height: 34px;
      border-radius: 8px;
      border: 1px solid var(--ink-100);
      background: transparent;
      color: var(--ink-500);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background-color 150ms ease, color 150ms ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: var(--ink-50); color: var(--ink-900); }
    }

    .icon-btn--danger:hover {
      background: #FEF2F2;
      color: #DC2626;
      border-color: #FECACA;
    }

    :host-context(body.dark-mode) {
      --ink-900: #F5F6FA;
      --ink-700: #C3C9D6;
      --ink-500: #8A93A6;
      --ink-200: #1E2638;
      --ink-100: #131826;
      --ink-50:  #0B0F1A;
    }
    :host-context(body.dark-mode) .topbar { background: #0B0F1A; border-bottom-color: #131826; }
    :host-context(body.dark-mode) .user-chip { background: #131826; border-color: #1E2638; }
    :host-context(body.dark-mode) .icon-btn--danger:hover { background: rgba(220,38,38,0.12); color: #FCA5A5; border-color: rgba(220,38,38,0.3); }
  `]
})
export class NavbarComponent {
  protected readonly authService = inject(AuthService);
  isDarkMode = signal(false);

  readonly initials = computed(() => {
    const email = this.authService.userEmail() ?? '';
    return email.split('@')[0].slice(0, 2).toUpperCase();
  });

  toggleDarkMode(): void {
    this.isDarkMode.update(v => !v);
    document.body.classList.toggle('dark-mode', this.isDarkMode());
  }
}
