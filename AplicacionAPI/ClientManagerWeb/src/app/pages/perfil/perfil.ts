import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-perfil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatIconModule],
  template: `
    <div class="page">

      @if (loading()) {
        <div class="loading-wrap"><div class="spinner"></div></div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error() }}</p>
        </div>
      } @else if (client(); as u) {

        <!-- Tarjeta de perfil -->
        <div class="profile-card">
          <div class="profile-avatar">{{ initials() }}</div>
          <div class="profile-info">
            <h1 class="profile-name">{{ u.name }}</h1>
            <span class="profile-role">Usuario · {{ u.companyName }}</span>
          </div>
        </div>

        <!-- Datos -->
        <section class="data-card">
          <h2 class="section-title">Información de cuenta</h2>

          <div class="field-list">
            <div class="field-item">
              <div class="field-icon-wrap">
                <mat-icon>mail_outline</mat-icon>
              </div>
              <div class="field-body">
                <span class="field-label">Email</span>
                <span class="field-value">{{ u.email }}</span>
              </div>
            </div>

            <div class="field-item">
              <div class="field-icon-wrap">
                <mat-icon>domain</mat-icon>
              </div>
              <div class="field-body">
                <span class="field-label">Empresa</span>
                <span class="field-value">{{ u.companyName }}</span>
              </div>
            </div>

            <div class="field-item">
              <div class="field-icon-wrap">
                <mat-icon>calendar_today</mat-icon>
              </div>
              <div class="field-body">
                <span class="field-label">Miembro desde</span>
                <span class="field-value">{{ u.createdAt | date:'MMMM yyyy' }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Acciones -->
        <div class="actions">
          <button type="button" class="btn-logout" (click)="authService.logout()">
            <mat-icon>logout</mat-icon>
            Cerrar sesión
          </button>
        </div>

      }
    </div>
  `,
  styles: [`
    :host {
      --ink-900: #0B0F1A;
      --ink-700: #1E2638;
      --ink-500: #4B5468;
      --ink-300: #8A93A6;
      --ink-100: #E6E9F0;
      --ink-50:  #F5F6FA;
      --accent:  #4F46E5;
      --accent-soft: #EEF0FF;
      font-family: 'Inter', system-ui, sans-serif;
      display: block;
    }

    .page {
      min-height: calc(100vh - 60px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      padding: 2rem 1rem;
    }

    .loading-wrap {
      display: flex;
      justify-content: center;
      padding: 4rem;
    }

    .spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--ink-100);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-state {
      text-align: center;
      color: var(--ink-500);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--ink-300); }
    }

    /* ── Profile card ── */

    .profile-card {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1.5rem 2rem;
      background: #fff;
      border: 1px solid var(--ink-100);
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
    }

    .profile-avatar {
      width: 60px; height: 60px;
      border-radius: 50%;
      background: var(--accent-soft);
      border: 2px solid rgba(79,70,229,0.2);
      color: var(--accent);
      font-size: 1.25rem;
      font-weight: 700;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .profile-name {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink-900);
      margin: 0 0 0.25rem;
    }

    .profile-role {
      font-size: 0.875rem;
      color: var(--ink-500);
    }

    /* ── Data card ── */

    .data-card {
      background: #fff;
      border: 1px solid var(--ink-100);
      border-radius: 16px;
      padding: 1.5rem;
      width: 100%;
      max-width: 480px;
    }

    .section-title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--ink-900);
      margin: 0 0 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--ink-100);
    }

    .field-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .field-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--ink-100);

      &:last-child { border-bottom: none; }
    }

    .field-icon-wrap {
      width: 36px; height: 36px;
      border-radius: 9px;
      background: var(--ink-50);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--ink-500); }
    }

    .field-body {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .field-label {
      font-size: 0.75rem;
      color: var(--ink-500);
      font-weight: 500;
    }

    .field-value {
      font-size: 0.9375rem;
      color: var(--ink-900);
      font-weight: 500;
    }

    /* ── Actions ── */

    .actions { width: 100%; max-width: 480px; }

    .btn-logout {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      height: 42px;
      border-radius: 10px;
      border: 1.5px solid #FECACA;
      background: transparent;
      color: #DC2626;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 150ms ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: #FEF2F2; }
    }

    /* ── Dark mode ── */

    :host-context(body.dark-mode) {
      --ink-900: #F5F6FA;
      --ink-700: #C3C9D6;
      --ink-500: #8A93A6;
      --ink-300: #4B5468;
      --ink-100: #131826;
      --ink-50:  #0B0F1A;
    }
    :host-context(body.dark-mode) .profile-card { background: #131826; }
    :host-context(body.dark-mode) .data-card    { background: #131826; }
    :host-context(body.dark-mode) .btn-logout { border-color: rgba(220,38,38,0.3); color: #FCA5A5; &:hover { background: rgba(220,38,38,0.1); } }
  `]
})
export class PerfilComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);

  client  = signal<User | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);

  readonly initials = computed(() => {
    const name = this.client()?.name ?? '';
    return name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  });

  ngOnInit(): void {
    this.userService.getMe().subscribe({
      next:  (u: User) => { this.client.set(u);  this.loading.set(false); },
      error: ()        => { this.error.set('No se pudieron cargar tus datos.'); this.loading.set(false); }
    });
  }
}
