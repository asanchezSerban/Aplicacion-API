import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-wrapper">
      <div class="login-card">

        <div class="login-header">
          <div class="login-logo">CM</div>
          <h1>ClientManager</h1>
          <p>Accede a tu cuenta para continuar</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="login-form">

          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" [(ngModel)]="email" name="email" required autocomplete="email" />
            <mat-icon matPrefix>mail_outline</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" name="password" required autocomplete="current-password" />
            <mat-icon matPrefix>lock_outline</mat-icon>
            <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          @if (errorMessage()) {
            <div class="login-error">
              <mat-icon>error_outline</mat-icon>
              {{ errorMessage() }}
            </div>
          }

          <button mat-flat-button type="submit" [disabled]="loading()">
            @if (loading()) {
              <mat-spinner diameter="20" />
            } @else {
              Iniciar sesión
            }
          </button>

          <a mat-button routerLink="/recuperar-password" class="forgot-link">
            ¿Olvidaste tu contraseña?
          </a>

        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--mat-sys-surface-container-lowest);
      padding: 1rem;
    }

    .login-card {
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .login-logo {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-size: 1.25rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
    }

    .login-header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.25rem;
      color: var(--mat-sys-on-surface);
    }

    .login-header p {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    mat-form-field {
      width: 100%;
    }

    .login-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      border-radius: 8px;
      font-size: 0.875rem;

      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    button[type="submit"] {
      width: 100%;
      height: 48px;
      margin-top: 0.5rem;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .forgot-link {
      width: 100%;
      justify-content: center;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `]
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  email    = '';
  password = '';

  loading      = signal(false);
  errorMessage = signal<string | null>(null);
  showPassword = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.authService.login({ email: this.email, password: this.password });
      if (result.requiresMfa) {
        const queryParams: Record<string, string> = { email: result.mfaEmail ?? '' };
        if (result.mfaType === 'email') {
          sessionStorage.setItem('mfa_sent_at', Date.now().toString());
        }
        if (result.mfaType) queryParams['mfaType'] = result.mfaType;
        this.router.navigate([ROUTES.MFA_VERIFY], { queryParams });
      }
    } catch (err: any) {
      const status = err?.status;
      const msg =
        status === 423 ? (err?.error?.error ?? 'Tu cuenta está bloqueada durante 15 minutos por demasiados intentos fallidos.') :
        status === 429 ? 'Demasiados intentos. Espera un minuto antes de intentarlo de nuevo.' :
        'Credenciales incorrectas. Inténtalo de nuevo.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
