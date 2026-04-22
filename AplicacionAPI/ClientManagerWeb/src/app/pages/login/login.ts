import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
    <div class="login-shell">

      <!-- Panel izquierdo: brand -->
      <aside class="brand-panel">
        <div class="brand-glow brand-glow--one"></div>
        <div class="brand-glow brand-glow--two"></div>

        <div class="brand-top">
          <div class="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7.5L12 3L20 7.5V16.5L12 21L4 16.5V7.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M12 12L20 7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M12 12V21" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M12 12L4 7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="brand-name">ClientManager</span>
        </div>

        <div class="brand-copy">
          <h2>Gestiona tus empresas y usuarios en un solo lugar.</h2>
          <p>Panel multitenant con autenticación en dos pasos, roles separados y auditoría integrada.</p>

          <ul class="brand-features">
            <li>
              <span class="feature-dot"></span>
              <span>Acceso seguro con 2FA — TOTP y Email OTP</span>
            </li>
            <li>
              <span class="feature-dot"></span>
              <span>Separación por roles — SuperAdmin y Cliente</span>
            </li>
            <li>
              <span class="feature-dot"></span>
              <span>Gestión centralizada de empresas y contactos</span>
            </li>
          </ul>
        </div>

        <div class="brand-footer">
          <span>© ClientManager</span>
        </div>
      </aside>

      <!-- Panel derecho: formulario -->
      <main class="form-panel">
        <div class="form-container">

          <header class="form-header">
            <h1>Bienvenido de nuevo</h1>
            <p>Introduce tus credenciales para continuar.</p>
          </header>

          <form (ngSubmit)="onSubmit()" class="login-form" novalidate>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required autocomplete="email" />
              <mat-icon matPrefix>mail_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contraseña</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" name="password" required autocomplete="current-password" />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            <a routerLink="/recuperar-password" class="forgot-link">
              ¿Olvidaste tu contraseña?
            </a>

            @if (errorMessage()) {
              <div class="login-error" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <button mat-flat-button type="submit" class="submit-btn" [disabled]="loading()">
              @if (loading()) {
                <mat-spinner diameter="20" />
              } @else {
                <span class="submit-label">
                  <span>Iniciar sesión</span>
                  <mat-icon>arrow_forward</mat-icon>
                </span>
              }
            </button>

          </form>

        </div>
      </main>

    </div>
  `,
  styles: [`
    :host {
      --ink-900: #0B0F1A;
      --ink-700: #1E2638;
      --ink-500: #4B5468;
      --ink-300: #8A93A6;
      --ink-200: #C3C9D6;
      --ink-100: #E6E9F0;
      --ink-50:  #F5F6FA;

      --accent:       #4F46E5;
      --accent-soft:  #EEF0FF;
      --accent-hover: #4338CA;

      font-family: 'Inter', system-ui, sans-serif;
    }

    .login-shell {
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      min-height: 100vh;
      background: #fff;
    }

    /* ── Panel izquierdo ───────────────────────────────────────── */

    .brand-panel {
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3rem 3.5rem;
      color: #fff;
      background:
        radial-gradient(120% 90% at 0% 0%, #3730A3 0%, transparent 55%),
        radial-gradient(100% 70% at 100% 100%, #1E1B4B 0%, transparent 60%),
        #0B0F1A;
      isolation: isolate;
    }

    .brand-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.45;
      pointer-events: none;
      z-index: 0;
    }
    .brand-glow--one {
      width: 420px; height: 420px;
      background: #6366F1;
      top: -120px; left: -120px;
      animation: float-one 14s ease-in-out infinite;
    }
    .brand-glow--two {
      width: 360px; height: 360px;
      background: #22D3EE;
      bottom: -80px; right: -80px;
      opacity: 0.22;
      animation: float-two 18s ease-in-out infinite;
    }

    @keyframes float-one {
      0%,100% { transform: translate(0, 0); }
      50%     { transform: translate(40px, 30px); }
    }
    @keyframes float-two {
      0%,100% { transform: translate(0, 0); }
      50%     { transform: translate(-30px, -20px); }
    }

    .brand-top,
    .brand-copy,
    .brand-footer { position: relative; z-index: 1; }

    .brand-top {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-mark {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      display: grid; place-items: center;
      backdrop-filter: blur(8px);
    }
    .brand-name {
      font-weight: 600;
      font-size: 1rem;
      letter-spacing: -0.01em;
    }

    .brand-copy h2 {
      font-size: 2.25rem;
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.02em;
      margin: 0 0 1rem;
      max-width: 460px;
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .brand-copy p {
      font-size: 1rem;
      line-height: 1.55;
      color: rgba(255,255,255,0.72);
      margin: 0 0 2.5rem;
      max-width: 440px;
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both;
    }

    .brand-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .brand-features li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: rgba(255,255,255,0.85);
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .brand-features li:nth-child(1) { animation-delay: 160ms; }
    .brand-features li:nth-child(2) { animation-delay: 220ms; }
    .brand-features li:nth-child(3) { animation-delay: 280ms; }

    .feature-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #22D3EE;
      flex-shrink: 0;
      box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.18);
    }

    .brand-footer {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.5);
    }

    /* ── Panel derecho ─────────────────────────────────────────── */

    .form-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      background: #fff;
    }

    .form-container {
      width: 100%;
      max-width: 380px;
      animation: rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .form-header {
      margin-bottom: 2rem;
    }
    .form-header h1 {
      font-size: 1.75rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--ink-900);
      margin: 0 0 0.5rem;
    }
    .form-header p {
      color: var(--ink-500);
      font-size: 0.9375rem;
      margin: 0;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    mat-form-field { width: 100%; }

    .forgot-link {
      align-self: flex-end;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.25rem 0.1rem;
      transition: color 150ms ease;
      margin-bottom: 0.5rem;
    }
    .forgot-link:hover { color: var(--accent-hover); }

    .login-error {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 0.875rem;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #991B1B;
      border-radius: 10px;
      font-size: 0.8125rem;
      line-height: 1.4;
      animation: rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: #DC2626;
      }
    }

    .submit-btn {
      width: 100%;
      height: 48px;
      margin-top: 0.75rem;
      font-size: 0.9375rem;
      font-weight: 600;
      letter-spacing: -0.005em;
      border-radius: 10px !important;
      background: var(--ink-900) !important;
      color: #fff !important;
      transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms ease;

      .submit-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      &:not([disabled]):hover {
        background: #000 !important;
        mat-icon { transform: translateX(3px); }
      }
      &:not([disabled]):active {
        transform: scale(0.98);
      }
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ────────────────────────────────────────────── */

    @media (max-width: 900px) {
      .login-shell { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
      .form-panel  { padding: 2rem 1.25rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .brand-glow--one,
      .brand-glow--two { animation: none; }
      .form-container,
      .brand-copy h2,
      .brand-copy p,
      .brand-features li,
      .login-error { animation: none; }
    }

    /* ── Dark mode ─────────────────────────────────────────────── */

    :host-context(body.dark-mode) {
      --ink-900: #F5F6FA;
      --ink-700: #C3C9D6;
      --ink-500: #8A93A6;
      --ink-300: #4B5468;
    }
    :host-context(body.dark-mode) .login-shell,
    :host-context(body.dark-mode) .form-panel { background: #0B0F1A; }

    :host-context(body.dark-mode) .submit-btn {
      background: #fff !important;
      color: #0B0F1A !important;
      &:not([disabled]):hover { background: #E6E9F0 !important; }
    }

    :host-context(body.dark-mode) .login-error {
      background: rgba(220, 38, 38, 0.1);
      border-color: rgba(220, 38, 38, 0.3);
      color: #FCA5A5;
    }
  `]
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);

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
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? undefined;
      const result = await this.authService.login({ email: this.email, password: this.password });

      if (result.requiresMfa) {
        const queryParams: Record<string, string> = { email: result.mfaEmail ?? '' };
        if (result.mfaType === 'email' && result.otpExpiresAt) {
          sessionStorage.setItem('mfa_otp_expires_at', result.otpExpiresAt);
        }
        if (result.mfaType) queryParams['mfaType'] = result.mfaType;
        if (returnUrl)       queryParams['returnUrl'] = returnUrl;
        this.router.navigate([ROUTES.MFA_VERIFY], { queryParams });
      } else {
        this.router.navigate([ROUTES.CONFIGURAR_TOTP]);
      }
    } catch (err: unknown) {
      const e = err as { status?: number; error?: { error?: string } };
      const status = e?.status;
      const msg =
        status === 423 ? (e?.error?.error ?? 'Tu cuenta está bloqueada durante 15 minutos por demasiados intentos fallidos.') :
        status === 429 ? 'Demasiados intentos. Espera un minuto antes de intentarlo de nuevo.' :
        'Credenciales incorrectas. Inténtalo de nuevo.';
      this.errorMessage.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
