import { Component, signal, inject, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Mínimo 8 caracteres',          test: p => p.length >= 8 },
  { label: 'Al menos una mayúscula',        test: p => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula',        test: p => /[a-z]/.test(p) },
  { label: 'Al menos un número',            test: p => /[0-9]/.test(p) },
  { label: 'Al menos un carácter especial', test: p => /[^A-Za-z0-9]/.test(p) },
];

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="page-wrapper">
      <div class="card">

        <div class="card-header">
          <div class="logo">CM</div>
          <h1>Nueva contraseña</h1>
          <p>Introduce tu nueva contraseña para restablecer el acceso.</p>
        </div>

        @if (done()) {
          <div class="success-box">
            <mat-icon>check_circle</mat-icon>
            <div>
              <strong>Contraseña restablecida</strong>
              <span>Ya puedes iniciar sesión con tu nueva contraseña.</span>
            </div>
          </div>
          <a mat-flat-button routerLink="/login" class="btn-full">Ir al login</a>

        } @else if (invalidLink()) {
          <div class="error-box">
            <mat-icon>error_outline</mat-icon>
            <div>
              <strong>Enlace inválido o expirado</strong>
              <span>Solicita un nuevo enlace de recuperación.</span>
            </div>
          </div>
          <a mat-button routerLink="/recuperar-password" class="btn-full">Solicitar nuevo enlace</a>

        } @else {
          <form (ngSubmit)="onSubmit()" class="form">

            <mat-form-field appearance="outline">
              <mat-label>Nueva contraseña</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'"
                     [(ngModel)]="password" name="newPassword" required
                     (ngModelChange)="onPasswordChange($event)" />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            @if (password.length > 0) {
              <div class="rules">
                @for (rule of rules(); track rule.label) {
                  <div class="rule" [class.ok]="rule.ok" [class.fail]="!rule.ok">
                    <mat-icon>{{ rule.ok ? 'check_circle' : 'cancel' }}</mat-icon>
                    <span>{{ rule.label }}</span>
                  </div>
                }
              </div>
            }

            @if (error()) {
              <div class="error-box inline">
                <mat-icon>error_outline</mat-icon>
                {{ error() }}
              </div>
            }

            <button mat-flat-button type="submit" [disabled]="loading() || !allValid()">
              @if (loading()) { <mat-spinner diameter="20" /> }
              @else { Restablecer contraseña }
            </button>

          </form>
        }

      </div>
    </div>
  `,
  styles: [`
    .page-wrapper {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: var(--mat-sys-surface-container-lowest);
      padding: 1rem;
    }

    .card {
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%; max-width: 420px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .card-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo {
      width: 56px; height: 56px;
      border-radius: 14px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-size: 1.25rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 1rem;
    }

    .card-header h1 { font-size: 1.4rem; font-weight: 600; margin: 0 0 0.5rem; }
    .card-header p  { font-size: 0.875rem; color: var(--mat-sys-on-surface-variant); margin: 0; }

    .form { display: flex; flex-direction: column; gap: 0.75rem; }
    mat-form-field { width: 100%; }

    .rules {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
    }

    .rule {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.82rem;
      transition: color 0.2s;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      &.ok   { color: #2e7d32; mat-icon { color: #2e7d32; } }
      &.fail { color: var(--mat-sys-on-surface-variant); mat-icon { color: #c62828; } }
    }

    .error-box {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      border-radius: 8px; font-size: 0.875rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; }
      div { display: flex; flex-direction: column; gap: 0.2rem; }
    }

    .success-box {
      display: flex; align-items: flex-start; gap: 0.75rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--mat-sys-primary) 30%, transparent);
      border-radius: 8px; font-size: 0.875rem;
      margin-bottom: 1rem;
      mat-icon { color: var(--mat-sys-primary); flex-shrink: 0; margin-top: 2px; }
      div { display: flex; flex-direction: column; gap: 0.25rem; }
      strong { color: var(--mat-sys-on-surface); }
      span { color: var(--mat-sys-on-surface-variant); }
    }

    button[type="submit"], .btn-full {
      width: 100%; height: 48px; margin-top: 0.25rem;
      font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);

  password     = '';
  showPassword = signal(false);
  loading      = signal(false);
  error        = signal<string | null>(null);
  done         = signal(false);
  invalidLink  = signal(false);

  private readonly _password = signal('');

  rules = computed(() =>
    PASSWORD_RULES.map(r => ({ label: r.label, ok: r.test(this._password()) }))
  );

  allValid = computed(() => this.rules().every(r => r.ok));

  private email = '';
  private token = '';

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.token = decodeURIComponent(this.route.snapshot.queryParamMap.get('token') ?? '');
    if (!this.email || !this.token) this.invalidLink.set(true);
  }

  onPasswordChange(value: string): void {
    this._password.set(value);
  }

  async onSubmit(): Promise<void> {
    if (!this.allValid()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.authService.resetPassword(this.email, this.token, this.password);
      this.done.set(true);
    } catch (err: any) {
      const msg = err?.error?.error ?? '';
      if (msg.toLowerCase().includes('enlace')) {
        this.invalidLink.set(true);
      } else {
        this.error.set(msg || 'Ha ocurrido un error. Inténtalo de nuevo.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
