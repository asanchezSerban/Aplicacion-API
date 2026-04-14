import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresAt: string;
  userEmail: string;
  role: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  clientId?: string;
  exp: number;
}

const TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly isLoggedIn = computed(() => {
    const token = this._token();
    if (!token) return false;
    const payload = this.decodeToken(token);
    if (!payload) return false;
    return payload.exp * 1000 > Date.now();
  });

  readonly userEmail = computed(() => this.decodeToken(this._token())?.email    ?? null);
  readonly userRole  = computed(() => this.decodeToken(this._token())?.role     ?? null);
  readonly clientId  = computed(() => this.decodeToken(this._token())?.clientId ?? null);

  async login(dto: LoginDto): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.apiUrl}/login`, dto, { withCredentials: true })
    );
    this.setToken(res.accessToken);
    this.router.navigate([res.role === 'SuperAdmin' ? '/empresas' : '/perfil']);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      );
    } finally {
      this.clearToken();
      this.router.navigate(['/login']);
    }
  }

  async refresh(): Promise<string | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<TokenResponse>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      );
      this.setToken(res.accessToken);
      return res.accessToken;
    } catch {
      this.clearToken();
      return null;
    }
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

  getToken(): string | null {
    return this._token();
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
  }

  private decodeToken(token: string | null): JwtPayload | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload)) as JwtPayload;
    } catch {
      return null;
    }
  }
}
