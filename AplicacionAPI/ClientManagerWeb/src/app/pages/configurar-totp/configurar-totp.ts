import {
  Component, signal, inject, OnInit, OnDestroy,
  ChangeDetectionStrategy, ViewChild, ElementRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, TotpSetupResponse } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';
import QRCode from 'qrcode';

@Component({
  selector: 'app-configurar-totp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
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
          <h2>Activa la autenticación en dos pasos para tu cuenta.</h2>
          <p>Un segundo factor protege tu acceso incluso si tu contraseña se ve comprometida. Recomendado para cuentas de administrador.</p>

          <div class="security-card">
            <div class="security-icon">
              <mat-icon>verified_user</mat-icon>
            </div>
            <div class="security-body">
              <strong>Cómo funciona</strong>
              <span>La app genera un código de 6 dígitos que cambia cada 30 segundos. Lo usas junto a tu contraseña al iniciar sesión.</span>
            </div>
          </div>

          <div class="apps-label">Compatible con</div>
          <ul class="apps-list">
            <li>
              <span class="app-dot"></span>
              <span>Google Authenticator</span>
            </li>
            <li>
              <span class="app-dot"></span>
              <span>Microsoft Authenticator</span>
            </li>
            <li>
              <span class="app-dot"></span>
              <span>Authy, 1Password, Bitwarden</span>
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

          @if (loading()) {
            <div class="loading-state">
              <mat-spinner diameter="32" />
            </div>
          } @else if (justConfirmed()) {

            <div class="success-state">
              <div class="success-icon">
                <mat-icon>verified_user</mat-icon>
              </div>
              <h1>2FA configurado correctamente</h1>
              <p>Tu cuenta ya está protegida. A partir de ahora necesitarás el código de la app en cada inicio de sesión.</p>

              <button mat-flat-button type="button" class="submit-btn" (click)="goBack()">
                <span class="submit-label">
                  <span>Ir al panel</span>
                  <mat-icon>arrow_forward</mat-icon>
                </span>
              </button>
            </div>

          } @else if (setup()) {

            <!-- Setup en curso: QR + clave + confirmación -->
            <header class="form-header">
              <div class="method-chip">
                <mat-icon>qr_code_scanner</mat-icon>
                <span>Configuración</span>
              </div>
              <h1>Escanea el código</h1>
              <p>Abre tu app de autenticación y escanea el QR para vincular tu cuenta.</p>
            </header>

            <div class="setup-body">

              @if (qrDataUrl()) {
                <div class="qr-wrap">
                  <img [src]="qrDataUrl()" alt="Código QR para Google Authenticator" width="200" height="200">
                </div>
              }

              <div class="secret-block">
                <div class="secret-label">
                  <mat-icon>key</mat-icon>
                  <span>O introduce la clave manualmente</span>
                </div>
                <div class="secret-row">
                  <code>{{ setup()!.secret }}</code>
                  <button type="button" class="copy-btn" (click)="copySecret()" [attr.aria-label]="'Copiar clave'">
                    <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
                  </button>
                </div>
              </div>

              <div class="confirm-block">
                <label class="confirm-label">Introduce el código de 6 dígitos</label>

                <div class="digits-row" (paste)="onPaste($event)">
                  <input #d0 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                         [class.error]="error()" autocomplete="one-time-code"
                         (input)="onDigitInput(0, $event)" (keydown)="onKeyDown(0, $event)">
                  <input #d1 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                         [class.error]="error()"
                         (input)="onDigitInput(1, $event)" (keydown)="onKeyDown(1, $event)">
                  <input #d2 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                         [class.error]="error()"
                         (input)="onDigitInput(2, $event)" (keydown)="onKeyDown(2, $event)">
                  <input #d3 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                         [class.error]="error()"
                         (input)="onDigitInput(3, $event)" (keydown)="onKeyDown(3, $event)">
                  <input #d4 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                         [class.error]="error()"
                         (input)="onDigitInput(4, $event)" (keydown)="onKeyDown(4, $event)">
                  <input #d5 class="digit-input" type="text" inputmode="numeric" maxlength="1"
                         [class.error]="error()"
                         (input)="onDigitInput(5, $event)" (keydown)="onKeyDown(5, $event)">
                </div>

                @if (error()) {
                  <div class="inline-error" role="alert">
                    <mat-icon>error_outline</mat-icon>
                    <span>{{ error() }}</span>
                  </div>
                }

                <button mat-flat-button type="button" class="submit-btn"
                        [disabled]="!codeComplete() || confirming()"
                        (click)="confirmSetup()">
                  @if (confirming()) {
                    <mat-spinner diameter="20" />
                  } @else {
                    <span class="submit-label">
                      <span>Confirmar y activar</span>
                      <mat-icon>arrow_forward</mat-icon>
                    </span>
                  }
                </button>
              </div>

            </div>

          } @else if (totpEnabled()) {

            <!-- TOTP activo -->
            <header class="form-header">
              <div class="method-chip method-chip--ok">
                <mat-icon>verified_user</mat-icon>
                <span>Activo</span>
              </div>
              <h1>Autenticación en dos pasos</h1>
              <p>Tu cuenta está protegida con una app TOTP.</p>
            </header>

            @if (success()) {
              <div class="success-box" role="status">
                <mat-icon>check_circle</mat-icon>
                <span>{{ success() }}</span>
              </div>
            }
            @if (error()) {
              <div class="inline-error" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <div class="status-card status-card--ok">
              <div class="status-icon">
                <mat-icon>shield</mat-icon>
              </div>
              <div class="status-body">
                <strong>Protección activa</strong>
                <span>Se solicitará un código de 6 dígitos en cada inicio de sesión.</span>
              </div>
            </div>

            <button mat-stroked-button type="button" class="danger-btn"
                    [disabled]="disabling()"
                    (click)="disable()">
              @if (disabling()) {
                <mat-spinner diameter="18" />
              } @else {
                <span class="submit-label">
                  <mat-icon>no_encryption</mat-icon>
                  <span>Desactivar 2FA</span>
                </span>
              }
            </button>

          } @else {

            <!-- TOTP inactivo -->
            <header class="form-header">
              <div class="method-chip method-chip--warn">
                <mat-icon>lock_open</mat-icon>
                <span>Sin activar</span>
              </div>
              <h1>Autenticación en dos pasos</h1>
              <p>Refuerza la seguridad de tu cuenta con una app de autenticación.</p>
            </header>

            @if (error()) {
              <div class="inline-error" role="alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ error() }}</span>
              </div>
            }

            <div class="status-card">
              <div class="status-icon">
                <mat-icon>lock_open</mat-icon>
              </div>
              <div class="status-body">
                <strong>Aún no has configurado 2FA</strong>
                <span>Necesitarás escanear un QR y verificar un código para completar la activación.</span>
              </div>
            </div>

            <button mat-flat-button type="button" class="submit-btn" (click)="startSetup()">
              <span class="submit-label">
                <mat-icon>qr_code_scanner</mat-icon>
                <span>Activar autenticación en dos pasos</span>
              </span>
            </button>

          }

          @if (!loading() && !justConfirmed()) {
            <div class="footer-links">
              <button type="button" class="link-btn link-btn--back" (click)="goBack()">
                <mat-icon>{{ totpEnabled() ? 'arrow_back' : 'logout' }}</mat-icon>
                <span>{{ totpEnabled() ? 'Volver al panel' : 'Cerrar sesión' }}</span>
              </button>
            </div>
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

    .apps-label {
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.5);
      margin-bottom: 0.75rem;
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) 200ms both;
    }
    .apps-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .apps-list li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
      color: rgba(255,255,255,0.85);
      animation: rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .apps-list li:nth-child(1) { animation-delay: 240ms; }
    .apps-list li:nth-child(2) { animation-delay: 300ms; }
    .apps-list li:nth-child(3) { animation-delay: 360ms; }

    .app-dot {
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
      max-width: 420px;
      animation: rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .loading-state {
      display: grid;
      place-items: center;
      min-height: 320px;
    }

    .form-header {
      margin-bottom: 1.5rem;
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
    .method-chip--ok {
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
    }
    .method-chip--warn {
      background: rgba(245, 158, 11, 0.12);
      color: #92400E;
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

    /* ── Status cards (inactivo / activo) ──────────────────────── */

    .status-card {
      display: flex;
      gap: 0.875rem;
      padding: 1rem 1.125rem;
      background: var(--ink-50);
      border: 1px solid var(--ink-100);
      border-radius: 12px;
      margin-bottom: 1rem;
    }
    .status-card--ok {
      background: rgba(16, 185, 129, 0.06);
      border-color: rgba(16, 185, 129, 0.2);
    }
    .status-icon {
      flex-shrink: 0;
      width: 36px; height: 36px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid var(--ink-100);
      display: grid; place-items: center;

      mat-icon {
        font-size: 20px; width: 20px; height: 20px;
        color: var(--ink-500);
      }
    }
    .status-card--ok .status-icon {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.3);
      mat-icon { color: var(--ok); }
    }
    .status-body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      strong {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--ink-900);
      }
      span {
        font-size: 0.8125rem;
        line-height: 1.5;
        color: var(--ink-500);
      }
    }

    /* ── Setup (QR + clave + digits) ───────────────────────────── */

    .setup-body {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .qr-wrap {
      align-self: center;
      padding: 0.875rem;
      background: #fff;
      border: 1px solid var(--ink-100);
      border-radius: 14px;
      box-shadow: 0 4px 12px rgba(11, 15, 26, 0.06);

      img {
        display: block;
        border-radius: 6px;
      }
    }

    .secret-block {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .secret-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--ink-500);

      mat-icon {
        font-size: 14px; width: 14px; height: 14px;
      }
    }
    .secret-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 0.75rem 0.625rem 0.875rem;
      background: var(--ink-50);
      border: 1px solid var(--ink-100);
      border-radius: 10px;

      code {
        flex: 1;
        font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
        font-size: 0.8125rem;
        font-weight: 500;
        letter-spacing: 0.03em;
        color: var(--ink-900);
        overflow-wrap: anywhere;
      }
    }
    .copy-btn {
      flex-shrink: 0;
      width: 32px; height: 32px;
      border-radius: 8px;
      border: 1px solid var(--ink-200);
      background: #fff;
      color: var(--ink-500);
      cursor: pointer;
      display: grid; place-items: center;
      transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease, transform 120ms cubic-bezier(0.22, 1, 0.36, 1);

      mat-icon {
        font-size: 16px; width: 16px; height: 16px;
      }

      &:hover {
        background: var(--ink-900);
        color: #fff;
        border-color: var(--ink-900);
      }
      &:active {
        transform: scale(0.94);
      }
    }

    .confirm-block {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .confirm-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--ink-900);
    }

    /* Digits */
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
    .digit-input:hover { border-color: var(--ink-300); }
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
      margin-bottom: 1rem;
      animation: rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both;

      mat-icon {
        font-size: 18px; width: 18px; height: 18px;
        flex-shrink: 0;
        color: var(--error);
      }
    }

    .success-box {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 0.875rem;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #047857;
      border-radius: 10px;
      font-size: 0.8125rem;
      margin-bottom: 1rem;
      animation: rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both;

      mat-icon {
        font-size: 18px; width: 18px; height: 18px;
        flex-shrink: 0;
        color: var(--ok);
      }
    }

    /* ── Botones ───────────────────────────────────────────────── */

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

    .danger-btn {
      width: 100%;
      height: 44px;
      margin-top: 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 10px !important;
      color: var(--error) !important;
      border: 1px solid rgba(220, 38, 38, 0.3) !important;
      background: transparent !important;
      transition: background-color 150ms ease, border-color 150ms ease;

      .submit-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }
      mat-icon {
        font-size: 16px; width: 16px; height: 16px;
      }

      &:not([disabled]):hover {
        background: rgba(220, 38, 38, 0.06) !important;
        border-color: rgba(220, 38, 38, 0.5) !important;
      }
    }

    /* ── Success state (just confirmed) ────────────────────────── */

    .success-state {
      text-align: center;
      padding: 1rem 0;
    }
    .success-icon {
      width: 72px; height: 72px;
      margin: 0 auto 1.5rem;
      border-radius: 20px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      display: grid; place-items: center;
      animation: pop 500ms cubic-bezier(0.22, 1, 0.36, 1) both;

      mat-icon {
        font-size: 36px; width: 36px; height: 36px;
        color: var(--ok);
      }
    }
    .success-state h1 {
      font-size: 1.625rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--ink-900);
      margin: 0 0 0.5rem;
    }
    .success-state p {
      color: var(--ink-500);
      font-size: 0.9375rem;
      line-height: 1.55;
      margin: 0 0 1.75rem;
    }

    @keyframes pop {
      from { opacity: 0; transform: scale(0.85); }
      to   { opacity: 1; transform: scale(1); }
    }

    /* ── Footer links ──────────────────────────────────────────── */

    .footer-links {
      margin-top: 1.5rem;
      display: flex;
      justify-content: center;
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
      color: var(--ink-500);
      cursor: pointer;
      transition: color 150ms ease;

      mat-icon {
        font-size: 15px; width: 15px; height: 15px;
        transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
      }

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
      .apps-label,
      .apps-list li,
      .inline-error,
      .success-box,
      .digit-input.error,
      .success-icon { animation: none; }
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
    :host-context(body.dark-mode) .digit-input:hover { border-color: #2A334A; }
    :host-context(body.dark-mode) .digit-input.filled {
      background: #1E2638;
      border-color: #F5F6FA;
    }

    :host-context(body.dark-mode) .status-card {
      background: #131826;
      border-color: #1E2638;
    }
    :host-context(body.dark-mode) .status-icon {
      background: #0B0F1A;
      border-color: #1E2638;
    }
    :host-context(body.dark-mode) .secret-row {
      background: #131826;
      border-color: #1E2638;
    }
    :host-context(body.dark-mode) .copy-btn {
      background: #1E2638;
      border-color: #2A334A;
      color: #C3C9D6;

      &:hover {
        background: #fff;
        color: #0B0F1A;
        border-color: #fff;
      }
    }
    :host-context(body.dark-mode) .qr-wrap {
      background: #fff;  /* QR siempre sobre blanco para escaneo */
      border-color: #1E2638;
    }

    :host-context(body.dark-mode) .method-chip {
      background: rgba(79, 70, 229, 0.15);
      color: #A5B4FC;
    }
    :host-context(body.dark-mode) .method-chip--ok {
      background: rgba(16, 185, 129, 0.15);
      color: #6EE7B7;
    }
    :host-context(body.dark-mode) .method-chip--warn {
      background: rgba(245, 158, 11, 0.15);
      color: #FCD34D;
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

    :host-context(body.dark-mode) .success-box {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.35);
      color: #6EE7B7;
      mat-icon { color: #6EE7B7; }
    }
  `]
})
export class ConfigurarTotpComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  @ViewChild('d0') d0?: ElementRef<HTMLInputElement>;
  @ViewChild('d1') d1?: ElementRef<HTMLInputElement>;
  @ViewChild('d2') d2?: ElementRef<HTMLInputElement>;
  @ViewChild('d3') d3?: ElementRef<HTMLInputElement>;
  @ViewChild('d4') d4?: ElementRef<HTMLInputElement>;
  @ViewChild('d5') d5?: ElementRef<HTMLInputElement>;

  loading        = signal(true);
  totpEnabled    = signal(false);
  justConfirmed  = signal(false);
  setup          = signal<TotpSetupResponse | null>(null);
  qrDataUrl      = signal<string | null>(null);
  confirming     = signal(false);
  disabling      = signal(false);
  error          = signal<string | null>(null);
  success        = signal<string | null>(null);
  codeComplete   = signal(false);
  copied         = signal(false);

  private confirmCode = '';
  private copiedTimeout: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const status = await this.authService.totpStatus();
      this.totpEnabled.set(status.enabled);
    } catch {
      this.error.set('No se pudo cargar el estado del 2FA.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
  }

  async startSetup(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.loading.set(true);
    try {
      const data   = await this.authService.totpSetup();
      const imgUrl = await QRCode.toDataURL(data.qrUri, { width: 220, margin: 2, color: { dark: '#0B0F1A', light: '#ffffff' } });
      this.setup.set(data);
      this.qrDataUrl.set(imgUrl);
      // Focus tras render
      queueMicrotask(() => this.d0?.nativeElement.focus());
    } catch {
      this.error.set('Error al iniciar la configuración. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;
    input.classList.toggle('filled', val !== '');
    this.error.set(null);
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

  private inputAt(index: number): HTMLInputElement {
    const refs = [this.d0, this.d1, this.d2, this.d3, this.d4, this.d5];
    return refs[index]!.nativeElement;
  }

  private refreshCodeComplete(): void {
    const code = [0,1,2,3,4,5].map(i => this.inputAt(i).value).join('');
    this.confirmCode = code;
    this.codeComplete.set(code.length === 6);
  }

  async confirmSetup(): Promise<void> {
    if (!this.codeComplete()) return;
    this.error.set(null);
    this.confirming.set(true);
    try {
      await this.authService.totpConfirm(this.confirmCode);
      this.totpEnabled.set(true);
      this.setup.set(null);
      this.qrDataUrl.set(null);
      this.confirmCode = '';
      this.codeComplete.set(false);
      this.justConfirmed.set(true);
    } catch (err: unknown) {
      this.error.set((err as { error?: { error?: string } })?.error?.error ?? 'Código incorrecto. Verifica que hayas escaneado el QR correctamente.');
      this.clearDigits();
    } finally {
      this.confirming.set(false);
    }
  }

  async disable(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.disabling.set(true);
    try {
      await this.authService.totpDisable();
      this.totpEnabled.set(false);
      this.success.set('Autenticación en dos pasos desactivada.');
    } catch (err: unknown) {
      this.error.set((err as { error?: { error?: string } })?.error?.error ?? 'Error al desactivar el 2FA.');
    } finally {
      this.disabling.set(false);
    }
  }

  async copySecret(): Promise<void> {
    const secret = this.setup()?.secret;
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      this.copied.set(true);
      if (this.copiedTimeout) clearTimeout(this.copiedTimeout);
      this.copiedTimeout = setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* ignore */
    }
  }

  goBack(): void {
    if (this.totpEnabled()) {
      this.router.navigate([ROUTES.COMPANIES]);
    } else {
      this.authService.logout();
    }
  }

  private clearDigits(): void {
    for (let i = 0; i < 6; i++) {
      const el = this.inputAt(i);
      el.value = '';
      el.classList.remove('filled');
    }
    this.confirmCode = '';
    this.codeComplete.set(false);
    this.d0?.nativeElement.focus();
  }
}
