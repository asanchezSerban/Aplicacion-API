import {
  Component, signal, inject, OnInit, OnDestroy, computed,
  ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-mfa-verificar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
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
          @if (mfaType() === 'totp') {
            <h2>Un paso más. Confirma tu identidad.</h2>
            <p>Abre tu aplicación de autenticación para obtener el código temporal.</p>
          } @else {
            <h2>Un paso más. Confirma tu identidad.</h2>
            <p>Te hemos enviado un código de 6 dígitos al correo asociado a tu cuenta.</p>
          }

          <div class="security-card">
            <div class="security-icon">
              <mat-icon>shield</mat-icon>
            </div>
            <div class="security-body">
              <strong>Autenticación en dos pasos</strong>
              <span>Esta verificación protege tu cuenta ante accesos no autorizados, incluso si tu contraseña se viera comprometida.</span>
            </div>
          </div>

          <ul class="brand-hints">
            @if (mfaType() === 'totp') {
              <li>
                <span class="hint-num">1</span>
                <span>Abre Google Authenticator (u otra app TOTP).</span>
              </li>
              <li>
                <span class="hint-num">2</span>
                <span>Localiza la entrada <strong>ClientManager</strong>.</span>
              </li>
              <li>
                <span class="hint-num">3</span>
                <span>Introduce el código de 6 dígitos antes de que caduque.</span>
              </li>
            } @else {
              <li>
                <span class="hint-num">1</span>
                <span>Abre tu bandeja de entrada.</span>
              </li>
              <li>
                <span class="hint-num">2</span>
                <span>Copia el código de 6 dígitos del mensaje.</span>
              </li>
              <li>
                <span class="hint-num">3</span>
                <span>Pégalo aquí antes de que expire.</span>
              </li>
            }
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
            <div class="method-chip">
              @if (mfaType() === 'totp') {
                <mat-icon>smartphone</mat-icon>
                <span>App de autenticación</span>
              } @else {
                <mat-icon>mark_email_read</mat-icon>
                <span>Código por email</span>
              }
            </div>
            <h1>Verificación en dos pasos</h1>
            @if (mfaType() === 'totp') {
              <p>Introduce el código de 6 dígitos que muestra tu app.</p>
            } @else {
              <p>Enviado a <strong>{{ email }}</strong></p>
            }
          </header>

          <form (ngSubmit)="onSubmit()" novalidate>

            @if (mfaType() === 'totp' && useBackupCode()) {
              <div class="backup-input-wrap">
                <input type="text" class="backup-code-input" placeholder="xxxx-xxxx"
                       maxlength="9" autocomplete="off" spellcheck="false"
                       [value]="backupCodeInput()"
                       (input)="backupCodeInput.set($any($event.target).value); errorMessage.set(null)" />
              </div>
            } @else {
              <div class="digits-row" (paste)="onPaste($event)">
                <input #d0 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                       [class.error]="errorMessage()" autocomplete="one-time-code"
                       (input)="onDigitInput(0, $event)" (keydown)="onKeyDown(0, $event)">
                <input #d1 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                       [class.error]="errorMessage()"
                       (input)="onDigitInput(1, $event)" (keydown)="onKeyDown(1, $event)">
                <input #d2 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                       [class.error]="errorMessage()"
                       (input)="onDigitInput(2, $event)" (keydown)="onKeyDown(2, $event)">
                <input #d3 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                       [class.error]="errorMessage()"
                       (input)="onDigitInput(3, $event)" (keydown)="onKeyDown(3, $event)">
                <input #d4 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                       [class.error]="errorMessage()"
                       (input)="onDigitInput(4, $event)" (keydown)="onKeyDown(4, $event)">
                <input #d5 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                       [class.error]="errorMessage()"
                       (input)="onDigitInput(5, $event)" (keydown)="onKeyDown(5, $event)">
              </div>
            }

            @if (errorMessage()) {
              <div class="inline-error" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            @if (mfaType() === 'email') {
              @if (timeLeft() > 0) {
                <div class="timer" [class.timer--low]="timeLeft() < 15">
                  <mat-icon>schedule</mat-icon>
                  <span>El código expira en <strong>{{ timeDisplay() }}</strong></span>
                </div>
              } @else {
                <div class="expired-box" role="alert">
                  <mat-icon>timer_off</mat-icon>
                  <span>El código ha expirado. Vuelve a iniciar sesión para recibir uno nuevo.</span>
                </div>
              }
            }

            @if (mfaType() === 'email' && timeLeft() === 0) {
              <button mat-flat-button type="button" (click)="goBack()" class="submit-btn">
                <span class="submit-label">
                  <span>Volver al login</span>
                  <mat-icon>arrow_forward</mat-icon>
                </span>
              </button>
            } @else {
              <button mat-flat-button type="submit"
                      [disabled]="(useBackupCode() ? backupCodeInput().replace('-','').length !== 8 : !codeComplete()) || loading()"
                      class="submit-btn">
                @if (loading()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <span class="submit-label">
                    <span>Verificar código</span>
                    <mat-icon>arrow_forward</mat-icon>
                  </span>
                }
              </button>
            }

          </form>

          <div class="footer-links">
            @if (mfaType() === 'totp') {
              <button type="button" class="link-btn" (click)="useBackupCode.update(v => !v); errorMessage.set(null); backupCodeInput.set('')">
                <mat-icon>{{ useBackupCode() ? 'smartphone' : 'key' }}</mat-icon>
                <span>{{ useBackupCode() ? 'Usar app de autenticación' : '¿Perdiste el acceso? Usa un código de respaldo' }}</span>
              </button>
            }
            @if (mfaType() === 'email' && timeLeft() > 0) {
              <button type="button" class="link-btn"
                      [disabled]="resendLoading() || resendCooldown() > 0"
                      (click)="onResend()">
                @if (resendLoading()) {
                  <mat-spinner diameter="14" />
                  <span>Enviando…</span>
                } @else if (resendCooldown() > 0) {
                  <mat-icon>schedule</mat-icon>
                  <span>Reenviar en {{ resendCooldown() }}s</span>
                } @else {
                  <mat-icon>send</mat-icon>
                  <span>Reenviar código</span>
                }
              </button>
            }
            <button type="button" class="link-btn link-btn--back" (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              <span>Volver al login</span>
            </button>
          </div>

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
      --warn:  #F59E0B;
      --error: #DC2626;

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
      margin: 0 0 1.75rem;
      max-width: 440px;
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both;
    }

    .security-card {
      display: flex;
      gap: 0.875rem;
      padding: 1rem 1.125rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(8px);
      border-radius: 12px;
      margin-bottom: 1.75rem;
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
    }
    .security-icon {
      flex-shrink: 0;
      width: 36px; height: 36px;
      border-radius: 10px;
      background: rgba(34, 211, 238, 0.12);
      border: 1px solid rgba(34, 211, 238, 0.3);
      display: grid; place-items: center;

      mat-icon {
        font-size: 20px; width: 20px; height: 20px;
        color: #22D3EE;
      }
    }
    .security-body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      strong {
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
      }
      span {
        font-size: 0.8125rem;
        line-height: 1.5;
        color: rgba(255,255,255,0.65);
      }
    }

    .brand-hints {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .brand-hints li {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      font-size: 0.9rem;
      color: rgba(255,255,255,0.85);
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .brand-hints li:nth-child(1) { animation-delay: 200ms; }
    .brand-hints li:nth-child(2) { animation-delay: 260ms; }
    .brand-hints li:nth-child(3) { animation-delay: 320ms; }

    .hint-num {
      flex-shrink: 0;
      width: 24px; height: 24px;
      border-radius: 50%;
      background: rgba(34, 211, 238, 0.12);
      border: 1px solid rgba(34, 211, 238, 0.35);
      color: #22D3EE;
      font-size: 0.75rem;
      font-weight: 600;
      display: grid; place-items: center;
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
    .method-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.7rem;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      margin-bottom: 0.875rem;

      mat-icon {
        font-size: 14px; width: 14px; height: 14px;
      }
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

      strong { color: var(--ink-900); font-weight: 600; }
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* ── Digits ────────────────────────────────────────────────── */

    .digits-row {
      display: flex;
      justify-content: space-between;
      gap: 0.375rem;
    }
    .digit-input {
      width: 54px;
      height: 58px;
      text-align: center;
      font-family: 'Inter', system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
      font-size: 1.375rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--ink-900);
      background: #fff;
      border: 1px solid var(--ink-200);
      border-radius: 10px;
      outline: none;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease,
        transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .digit-input:hover {
      border-color: var(--ink-300);
    }
    .digit-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
    }
    .digit-input.filled {
      border-color: var(--ink-900);
      background: var(--ink-50);
    }
    .digit-input.error {
      border-color: var(--error);
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
      animation: shake 320ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }

    @keyframes shake {
      10%, 90% { transform: translateX(-1px); }
      20%, 80% { transform: translateX(2px); }
      30%, 50%, 70% { transform: translateX(-3px); }
      40%, 60% { transform: translateX(3px); }
    }

    .inline-error {
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
        font-size: 18px; width: 18px; height: 18px;
        flex-shrink: 0;
        color: var(--error);
      }
    }

    .timer {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--ink-500);
      padding: 0.1rem 0.1rem;
      transition: color 200ms ease;

      mat-icon {
        font-size: 16px; width: 16px; height: 16px;
      }
      strong {
        color: var(--ink-900);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
    }
    .timer--low {
      color: var(--warn);
      strong { color: var(--warn); }
    }

    .expired-box {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 0.875rem;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #92400E;
      border-radius: 10px;
      font-size: 0.8125rem;
      line-height: 1.45;
      animation: rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both;

      mat-icon {
        font-size: 18px; width: 18px; height: 18px;
        flex-shrink: 0;
        color: var(--warn);
        margin-top: 1px;
      }
    }

    /* ── Submit ────────────────────────────────────────────────── */

    .submit-btn {
      width: 100%;
      height: 48px;
      margin-top: 0.25rem;
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
        font-size: 18px; width: 18px; height: 18px;
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

    /* ── Footer links ──────────────────────────────────────────── */

    .footer-links {
      margin-top: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .link-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: transparent;
      border: none;
      padding: 0.375rem 0.25rem;
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--accent);
      cursor: pointer;
      transition: color 150ms ease;

      mat-icon {
        font-size: 15px; width: 15px; height: 15px;
        transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      &:hover:not([disabled]) {
        color: var(--accent-hover);
      }
      &[disabled] {
        color: var(--ink-300);
        cursor: default;
      }
    }
    .link-btn--back {
      color: var(--ink-500);
      &:hover:not([disabled]) {
        color: var(--ink-900);
        mat-icon { transform: translateX(-3px); }
      }
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ────────────────────────────────────────────── */

    @media (max-width: 900px) {
      .auth-shell { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
      .form-panel  { padding: 2rem 1.25rem; }
    }

    @media (max-width: 420px) {
      .digit-input {
        width: 44px;
        height: 50px;
        font-size: 1.25rem;
      }
      .digits-row { gap: 0.3rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .brand-glow--one,
      .brand-glow--two { animation: none; }
      .form-container,
      .brand-copy h2,
      .brand-copy p,
      .security-card,
      .brand-hints li,
      .inline-error,
      .expired-box,
      .digit-input.error { animation: none; }
    }

    /* ── Dark mode ─────────────────────────────────────────────── */

    :host-context(body.dark-mode) {
      --ink-900: #F5F6FA;
      --ink-700: #C3C9D6;
      --ink-500: #8A93A6;
      --ink-300: #4B5468;
      --ink-200: #1E2638;
      --ink-100: #131826;
      --ink-50:  #0B0F1A;
    }
    :host-context(body.dark-mode) .auth-shell,
    :host-context(body.dark-mode) .form-panel { background: #0B0F1A; }

    :host-context(body.dark-mode) .digit-input {
      background: #131826;
      border-color: #1E2638;
      color: #F5F6FA;
    }
    :host-context(body.dark-mode) .digit-input:hover {
      border-color: #2A334A;
    }
    :host-context(body.dark-mode) .digit-input.filled {
      background: #1E2638;
      border-color: #F5F6FA;
    }

    :host-context(body.dark-mode) .method-chip {
      background: rgba(79, 70, 229, 0.15);
      color: #A5B4FC;
    }

    :host-context(body.dark-mode) .submit-btn {
      background: #fff !important;
      color: #0B0F1A !important;
      &:not([disabled]):hover { background: #E6E9F0 !important; }
    }

    :host-context(body.dark-mode) .inline-error {
      background: rgba(220, 38, 38, 0.1);
      border-color: rgba(220, 38, 38, 0.3);
      color: #FCA5A5;

      mat-icon { color: #FCA5A5; }
    }

    :host-context(body.dark-mode) .expired-box {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.3);
      color: #FCD34D;
    }
  `]
})
export class MfaVerificarComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);

  @ViewChild('d0') d0!: ElementRef<HTMLInputElement>;
  @ViewChild('d1') d1!: ElementRef<HTMLInputElement>;
  @ViewChild('d2') d2!: ElementRef<HTMLInputElement>;
  @ViewChild('d3') d3!: ElementRef<HTMLInputElement>;
  @ViewChild('d4') d4!: ElementRef<HTMLInputElement>;
  @ViewChild('d5') d5!: ElementRef<HTMLInputElement>;

  loading         = signal(false);
  resendLoading   = signal(false);
  resendCooldown  = signal(0);
  errorMessage    = signal<string | null>(null);
  codeComplete    = signal(false);
  mfaType         = signal<'email' | 'totp'>('email');
  useBackupCode   = signal(false);
  backupCodeInput = signal('');
  private static readonly OTP_TTL_FALLBACK = 60;
  private static readonly RESEND_COOLDOWN  = 30;
  timeLeft = signal(MfaVerificarComponent.OTP_TTL_FALLBACK);

  email = '';
  private timerInterval:    ReturnType<typeof setInterval> | null = null;
  private cooldownInterval: ReturnType<typeof setInterval> | null = null;

  readonly timeDisplay = computed(() => {
    const m = Math.floor(this.timeLeft() / 60).toString().padStart(2, '0');
    const s = (this.timeLeft() % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    if (!this.email) {
      this.router.navigate([ROUTES.LOGIN]);
      return;
    }

    const type = this.route.snapshot.queryParamMap.get('mfaType');
    this.mfaType.set(type === 'totp' ? 'totp' : 'email');

    if (this.mfaType() === 'email') {
      const expiresAt = sessionStorage.getItem('mfa_otp_expires_at');
      const remaining = expiresAt
        ? Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000))
        : MfaVerificarComponent.OTP_TTL_FALLBACK;
      this.timeLeft.set(remaining);
      this.startTimer();
    }
  }

  ngAfterViewInit(): void {
    this.d0.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.clearCooldown();
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;
    input.classList.toggle('filled', val !== '');
    this.errorMessage.set(null);
    this.refreshCodeComplete();

    if (val && index < 5) {
      this.inputAt(index + 1).focus();
    }
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const el = this.inputAt(index);
      if (el.value) {
        el.value = '';
        el.classList.remove('filled');
        this.refreshCodeComplete();
      } else if (index > 0) {
        this.inputAt(index - 1).focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.inputAt(index - 1).focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.inputAt(index + 1).focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    if (!pasted) return;

    for (let i = 0; i < 6; i++) {
      const el  = this.inputAt(i);
      const val = pasted[i] ?? '';
      el.value  = val;
      el.classList.toggle('filled', val !== '');
    }
    this.refreshCodeComplete();

    const nextEmpty = [0,1,2,3,4,5].find(i => this.inputAt(i).value === '') ?? 5;
    this.inputAt(nextEmpty).focus();
  }

  async onSubmit(): Promise<void> {
    const isBackup = this.useBackupCode();
    const code = isBackup
      ? this.backupCodeInput().trim()
      : [0,1,2,3,4,5].map(i => this.inputAt(i).value).join('');

    const ready = isBackup ? code.replace('-', '').length === 8 : this.codeComplete();
    if (!ready) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? undefined;
    try {
      await this.authService.mfaVerify(this.email, code, returnUrl);
      sessionStorage.removeItem('mfa_otp_expires_at');
    } catch (err: unknown) {
      const e = err as { error?: { error?: string } };
      const msg = e?.error?.error ?? 'Código incorrecto. Inténtalo de nuevo.';
      this.errorMessage.set(msg);
      if (!isBackup) this.clearDigits();
    } finally {
      this.loading.set(false);
    }
  }

  private inputAt(index: number): HTMLInputElement {
    const refs = [this.d0, this.d1, this.d2, this.d3, this.d4, this.d5];
    return refs[index].nativeElement;
  }

  private refreshCodeComplete(): void {
    const allFilled = [0,1,2,3,4,5].every(i => this.inputAt(i).value !== '');
    this.codeComplete.set(allFilled);
  }

  async onResend(): Promise<void> {
    this.resendLoading.set(true);
    this.errorMessage.set(null);
    try {
      const otpExpiresAt = await this.authService.resendOtp(this.email);
      sessionStorage.setItem('mfa_otp_expires_at', otpExpiresAt);
      this.clearTimer();
      const remaining = Math.max(0, Math.floor((Date.parse(otpExpiresAt) - Date.now()) / 1000));
      this.timeLeft.set(remaining);
      this.startTimer();
      this.clearDigits();
      this.startCooldown();
    } catch {
      this.errorMessage.set('No se pudo reenviar el código. Inténtalo de nuevo.');
    } finally {
      this.resendLoading.set(false);
    }
  }

  goBack(): void {
    sessionStorage.removeItem('mfa_otp_expires_at');
    this.router.navigate([ROUTES.LOGIN]);
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      if (this.timeLeft() <= 0) {
        this.clearTimer();
        return;
      }
      this.timeLeft.update(t => t - 1);
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private startCooldown(): void {
    this.resendCooldown.set(MfaVerificarComponent.RESEND_COOLDOWN);
    this.cooldownInterval = setInterval(() => {
      if (this.resendCooldown() <= 1) {
        this.resendCooldown.set(0);
        this.clearCooldown();
      } else {
        this.resendCooldown.update(c => c - 1);
      }
    }, 1000);
  }

  private clearCooldown(): void {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
      this.cooldownInterval = null;
    }
  }

  private clearDigits(): void {
    for (let i = 0; i < 6; i++) {
      this.inputAt(i).value = '';
      this.inputAt(i).classList.remove('filled');
    }
    this.codeComplete.set(false);
    this.d0.nativeElement.focus();
  }
}
