import { Component, signal, inject, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { PASSWORD_RULES } from '../../constants/password-rules';

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="auth-shell">

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
          <h2>Casi listo. Elige una nueva contraseña segura.</h2>
          <p>Usa una combinación única que no reutilices en otros servicios. Nosotros nos encargamos del resto.</p>

          <div class="security-card">
            <div class="security-card-top">
              <mat-icon>shield</mat-icon>
              <span>Tu contraseña está protegida</span>
            </div>
            <ul class="security-points">
              <li>
                <span class="check">
                  <mat-icon>check</mat-icon>
                </span>
                <span>Almacenada con hash, nunca en texto plano</span>
              </li>
              <li>
                <span class="check">
                  <mat-icon>check</mat-icon>
                </span>
                <span>Enlaces de recuperación de un solo uso</span>
              </li>
              <li>
                <span class="check">
                  <mat-icon>check</mat-icon>
                </span>
                <span>Expiración automática a los 30 minutos</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="brand-footer">
          <span>© ClientManager</span>
        </div>
      </aside>

      <!-- Panel derecho: formulario -->
      <main class="form-panel">
        <div class="form-container">

          @if (done()) {
            <div class="state-box">
              <div class="state-icon state-icon--ok">
                <mat-icon>check_circle</mat-icon>
              </div>
              <h1>Contraseña restablecida</h1>
              <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <a routerLink="/login" class="primary-btn">
                <span class="submit-label">
                  <span>Ir al login</span>
                  <mat-icon>arrow_forward</mat-icon>
                </span>
              </a>
            </div>

          } @else if (invalidLink()) {
            <div class="state-box">
              <div class="state-icon state-icon--error">
                <mat-icon>link_off</mat-icon>
              </div>
              <h1>Enlace no válido</h1>
              <p>El enlace ha expirado o ya se ha utilizado. Solicita uno nuevo desde la página de recuperación.</p>
              <a routerLink="/recuperar-password" class="primary-btn">
                <span class="submit-label">
                  <span>Solicitar nuevo enlace</span>
                  <mat-icon>arrow_forward</mat-icon>
                </span>
              </a>
            </div>

          } @else {

            <header class="form-header">
              <h1>Nueva contraseña</h1>
              <p>Introduce una contraseña segura que cumpla todos los requisitos.</p>
            </header>

            <form (ngSubmit)="onSubmit()" class="form" novalidate>

              <mat-form-field appearance="outline">
                <mat-label>Nueva contraseña</mat-label>
                <input matInput [type]="showPassword() ? 'text' : 'password'"
                       [(ngModel)]="password" name="newPassword" required
                       (ngModelChange)="onPasswordChange($event)" />
                <mat-icon matPrefix>lock_outline</mat-icon>
                <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>

              @if (password.length > 0) {
                <div class="rules">
                  <div class="rules-header">
                    <span>Requisitos</span>
                    <span class="rules-count">{{ passedCount() }}/{{ rules().length }}</span>
                  </div>
                  <div class="rules-list">
                    @for (rule of rules(); track rule.label) {
                      <div class="rule" [class.ok]="rule.ok">
                        <span class="rule-dot">
                          @if (rule.ok) {
                            <mat-icon>check</mat-icon>
                          }
                        </span>
                        <span>{{ rule.label }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (error()) {
                <div class="error-box" role="alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ error() }}</span>
                </div>
              }

              <button mat-flat-button type="submit" class="submit-btn" [disabled]="loading() || !allValid()">
                @if (loading()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <span class="submit-label">
                    <span>Restablecer contraseña</span>
                    <mat-icon>arrow_forward</mat-icon>
                  </span>
                }
              </button>

              <a routerLink="/login" class="back-link">
                <mat-icon>arrow_back</mat-icon>
                <span>Volver al login</span>
              </a>

            </form>
          }

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

      --ok:    #10B981;

      font-family: 'Inter', system-ui, sans-serif;
    }

    .auth-shell {
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

    .security-card {
      padding: 1.25rem;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      backdrop-filter: blur(8px);
      max-width: 420px;
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 160ms both;
    }

    .security-card-top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #fff;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #22D3EE;
      }
    }

    .security-points {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }
    .security-points li {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.8125rem;
      color: rgba(255,255,255,0.78);
    }

    .check {
      width: 18px; height: 18px;
      border-radius: 50%;
      background: rgba(34, 211, 238, 0.15);
      display: grid; place-items: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
        color: #22D3EE;
      }
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
      max-width: 420px;
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
      line-height: 1.5;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    mat-form-field { width: 100%; }

    /* ── Reglas de contraseña ──────────────────────────────────── */

    .rules {
      padding: 0.875rem 1rem;
      background: var(--ink-50);
      border: 1px solid var(--ink-100);
      border-radius: 10px;
      animation: rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .rules-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ink-500);
    }

    .rules-count {
      font-variant-numeric: tabular-nums;
      color: var(--ink-900);
    }

    .rules-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .rule {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.8125rem;
      color: var(--ink-500);
      transition: color 200ms ease;

      &.ok {
        color: var(--ink-900);
        .rule-dot {
          background: var(--ok);
          border-color: var(--ok);
          mat-icon { color: #fff; }
        }
      }
    }

    .rule-dot {
      width: 18px; height: 18px;
      border-radius: 50%;
      border: 1.5px solid var(--ink-200);
      background: #fff;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition: background 200ms ease, border-color 200ms ease;

      mat-icon {
        font-size: 12px;
        width: 12px;
        height: 12px;
        color: transparent;
        transition: color 200ms ease;
      }
    }

    /* ── Estados ───────────────────────────────────────────────── */

    .error-box {
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

    /* ── Botones ───────────────────────────────────────────────── */

    .submit-btn,
    .primary-btn {
      width: 100%;
      height: 48px;
      margin-top: 0.75rem;
      font-size: 0.9375rem;
      font-weight: 600;
      letter-spacing: -0.005em;
      border-radius: 10px !important;
      background: var(--ink-900) !important;
      color: #fff !important;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
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

    .back-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      margin-top: 1rem;
      color: var(--ink-500);
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.5rem;
      transition: color 150ms ease;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      &:hover {
        color: var(--ink-900);
        mat-icon { transform: translateX(-3px); }
      }
    }

    /* ── State boxes (éxito / enlace inválido) ─────────────────── */

    .state-box {
      text-align: center;
      animation: rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .state-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      margin: 0 auto 1.5rem;
      animation: pop 500ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }

    .state-icon--ok {
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      mat-icon { color: var(--ok); }
    }
    .state-icon--error {
      background: #FEF2F2;
      mat-icon { color: #DC2626; }
    }

    .state-box h1 {
      font-size: 1.75rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--ink-900);
      margin: 0 0 0.75rem;
    }
    .state-box p {
      color: var(--ink-500);
      font-size: 0.9375rem;
      line-height: 1.5;
      margin: 0 0 2rem;
    }

    /* ── Animaciones ───────────────────────────────────────────── */

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes pop {
      from { opacity: 0; transform: scale(0.9); }
      to   { opacity: 1; transform: scale(1); }
    }

    /* ── Responsive ────────────────────────────────────────────── */

    @media (max-width: 900px) {
      .auth-shell { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
      .form-panel  { padding: 2rem 1.25rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .brand-glow--one,
      .brand-glow--two { animation: none; }
      .form-container,
      .brand-copy h2,
      .brand-copy p,
      .security-card,
      .rules,
      .error-box,
      .state-box,
      .state-icon { animation: none; }
      .rule, .rule-dot, .rule-dot mat-icon { transition: none; }
    }

    /* ── Dark mode ─────────────────────────────────────────────── */

    :host-context(body.dark-mode) {
      --ink-900: #F5F6FA;
      --ink-700: #C3C9D6;
      --ink-500: #8A93A6;
      --ink-300: #4B5468;
      --ink-200: #1E2638;
      --ink-100: #131826;
      --ink-50:  #0F1423;
    }
    :host-context(body.dark-mode) .auth-shell,
    :host-context(body.dark-mode) .form-panel { background: #0B0F1A; }

    :host-context(body.dark-mode) .submit-btn,
    :host-context(body.dark-mode) .primary-btn {
      background: #fff !important;
      color: #0B0F1A !important;
      &:not([disabled]):hover { background: #E6E9F0 !important; }
    }

    :host-context(body.dark-mode) .rule-dot {
      background: #0B0F1A;
    }

    :host-context(body.dark-mode) .error-box {
      background: rgba(220, 38, 38, 0.1);
      border-color: rgba(220, 38, 38, 0.3);
      color: #FCA5A5;
    }
    :host-context(body.dark-mode) .state-icon--error {
      background: rgba(220, 38, 38, 0.1);
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

  passedCount = computed(() => this.rules().filter(r => r.ok).length);

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
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error ?? '';
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
