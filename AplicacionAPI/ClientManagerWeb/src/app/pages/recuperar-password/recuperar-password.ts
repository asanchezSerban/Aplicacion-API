import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recuperar-password',
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
          <h1>Recuperar contraseña</h1>
          <p>Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.</p>
        </div>

        @if (sent()) {
          <div class="success-box">
            <mat-icon>mark_email_read</mat-icon>
            <div>
              <strong>Email enviado</strong>
              <span>Si el email está registrado, recibirás el enlace en breve. Revisa también la carpeta de spam.</span>
            </div>
          </div>
          <a mat-button routerLink="/login" class="back-link">
            <mat-icon>arrow_back</mat-icon> Volver al login
          </a>
        } @else {
          <form (ngSubmit)="onSubmit()" class="form">

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required autocomplete="email" />
              <mat-icon matPrefix>mail_outline</mat-icon>
            </mat-form-field>

            @if (error()) {
              <div class="error-box">
                <mat-icon>error_outline</mat-icon>
                {{ error() }}
              </div>
            }

            <button mat-flat-button type="submit" [disabled]="loading()">
              @if (loading()) { <mat-spinner diameter="20" /> }
              @else { Enviar enlace }
            </button>

            <a mat-button routerLink="/login" class="back-link">
              <mat-icon>arrow_back</mat-icon> Volver al login
            </a>

          </form>
        }

      </div>
    </div>
  `,
  styles: [`
    .page-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--mat-sys-surface-container-lowest);
      padding: 1rem;
    }

    .card {
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 400px;
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

    .form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    mat-form-field { width: 100%; }

    .error-box {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      border-radius: 8px; font-size: 0.875rem;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
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

    button[type="submit"] {
      width: 100%; height: 48px; margin-top: 0.5rem;
      font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }

    .back-link { width: 100%; justify-content: center; }
  `]
})
export class RecuperarPasswordComponent {
  private readonly authService = inject(AuthService);

  email   = '';
  loading = signal(false);
  error   = signal<string | null>(null);
  sent    = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.email) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.authService.forgotPassword(this.email);
      this.sent.set(true);
    } catch {
      this.error.set('Ha ocurrido un error. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
