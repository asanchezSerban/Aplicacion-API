import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ROLES } from '../constants/roles';

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  requiresMfa:   boolean;
  mfaEmail?:     string;
  mfaType?:      'email' | 'totp';
  otpExpiresAt?: string;  // ISO 8601 — solo cuando mfaType === 'email'
  // Identidad (cuando requiresMfa = false — tokens van en cookies HttpOnly)
  email?:       string;
  role?:        string;
  totpEnabled?: boolean;
}

export interface TotpSetupResponse {
  qrUri:  string;
  secret: string;
}

export interface TotpStatus {
  enabled: boolean;
}

/** Identidad del usuario autenticado — se mantiene en memoria, nunca en localStorage. */
export interface Identity {
  email:       string;
  role:        string;
  totpEnabled: boolean;
  userId?:     string;  // solo rol Cliente
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  // Estado en memoria — ningún dato sensible toca localStorage/sessionStorage
  private readonly _identity = signal<Identity | null>(null);

  readonly isLoggedIn  = computed(() => this._identity() !== null);
  readonly userEmail   = computed(() => this._identity()?.email       ?? null);
  readonly userRole    = computed(() => this._identity()?.role        ?? null);
  readonly clientId    = computed(() => this._identity()?.userId      ?? null);
  /** true solo cuando el SuperAdmin ya tiene TOTP activado. */
  readonly totpEnabled = computed(() => this._identity()?.totpEnabled ?? false);

  /**
   * Llamado una vez al arrancar la app (APP_INITIALIZER).
   * Si las cookies de sesión son válidas, hidratar el estado en memoria.
   * Si no, _identity queda null → isLoggedIn = false.
   */
  async initializeAuth(): Promise<void> {
    try {
      const identity = await firstValueFrom(
        this.http.get<Identity>(`${this.apiUrl}/me`, { withCredentials: true })
      );
      this._identity.set(identity);
    } catch {
      this._identity.set(null);
    }
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.apiUrl}/login`, dto, { withCredentials: true })
    );
    // Si no hay MFA pendiente, el servidor ha emitido cookies y devuelto la identidad
    if (!res.requiresMfa && res.email) {
      this._identity.set({
        email:       res.email,
        role:        res.role!,
        totpEnabled: res.totpEnabled ?? false
      });
    }
    return res;
  }

  async mfaVerify(email: string, code: string, returnUrl?: string): Promise<void> {
    const identity = await firstValueFrom(
      this.http.post<Identity>(`${this.apiUrl}/mfa-verify`, { email, code }, { withCredentials: true })
    );
    this._identity.set(identity);
    const defaultRoute = identity.role === ROLES.SUPER_ADMIN ? '/empresas' : '/perfil';
    const destination  = (returnUrl && this.isSafeReturnUrl(returnUrl)) ? returnUrl : defaultRoute;
    this.router.navigate([destination]);
  }

  /** Verifica que la URL es interna y no apunta a páginas de auth (previene open-redirect). */
  isSafeReturnUrl(url: string): boolean {
    if (!url.startsWith('/')) return false;
    const blocked = ['/login', '/mfa-verificar', '/recuperar-password', '/reset-password'];
    return !blocked.some(b => url.startsWith(b));
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      );
    } finally {
      this._identity.set(null);
      this.router.navigate(['/login']);
    }
  }

  /**
   * Solicita un nuevo access token usando el refresh token de la cookie.
   * Retorna true si tuvo éxito (el interceptor puede reintentar la petición original).
   */
  async refresh(): Promise<boolean> {
    try {
      const identity = await firstValueFrom(
        this.http.post<Identity>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      );
      this._identity.set(identity);
      return true;
    } catch {
      this._identity.set(null);
      return false;
    }
  }

  async resendOtp(email: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ message: string; otpExpiresAt: string }>(`${this.apiUrl}/resend-otp`, { email })
    );
    return res.otpExpiresAt;
  }

  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.apiUrl}/forgot-password`, { email })
    );
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${this.apiUrl}/reset-password`, { email, token, newPassword })
    );
  }

  // ── TOTP ──────────────────────────────────────────────────────────────────

  async totpStatus(): Promise<TotpStatus> {
    return firstValueFrom(
      this.http.get<TotpStatus>(`${this.apiUrl}/totp/status`, { withCredentials: true })
    );
  }

  async totpSetup(): Promise<TotpSetupResponse> {
    return firstValueFrom(
      this.http.get<TotpSetupResponse>(`${this.apiUrl}/totp/setup`, { withCredentials: true })
    );
  }

  async totpConfirm(code: string): Promise<void> {
    const identity = await firstValueFrom(
      this.http.post<Identity>(`${this.apiUrl}/totp/confirm`, { code }, { withCredentials: true })
    );
    // El nuevo JWT (en cookie) tiene totpEnabled=true — actualizar identidad en memoria
    this._identity.set(identity);
  }

  async totpDisable(): Promise<void> {
    const identity = await firstValueFrom(
      this.http.post<Identity>(`${this.apiUrl}/totp/disable`, {}, { withCredentials: true })
    );
    // El nuevo JWT (en cookie) tiene totpEnabled=false — el adminGuard bloqueará el acceso
    this._identity.set(identity);
  }
}
