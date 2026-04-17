import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { AuthService, TotpSetupResponse } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';
import QRCode from 'qrcode';

@Component({
  selector: 'app-configurar-totp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatCardModule],
  templateUrl: './configurar-totp.html',
  styleUrl:    './configurar-totp.scss'
})
export class ConfigurarTotpComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  loading        = signal(true);
  totpEnabled    = signal(false);
  justConfirmed  = signal(false);
  setup       = signal<TotpSetupResponse | null>(null);
  qrDataUrl   = signal<string | null>(null);
  confirmCode = '';
  confirming  = signal(false);
  disabling   = signal(false);
  error       = signal<string | null>(null);
  success     = signal<string | null>(null);

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

  async startSetup(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.loading.set(true);
    try {
      const data   = await this.authService.totpSetup();
      const imgUrl = await QRCode.toDataURL(data.qrUri, { width: 220, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
      this.setup.set(data);
      this.qrDataUrl.set(imgUrl);
    } catch {
      this.error.set('Error al iniciar la configuración. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  async confirmSetup(): Promise<void> {
    if (this.confirmCode.length !== 6) return;
    this.error.set(null);
    this.confirming.set(true);
    try {
      await this.authService.totpConfirm(this.confirmCode);
      this.totpEnabled.set(true);
      this.setup.set(null);
      this.qrDataUrl.set(null);
      this.confirmCode = '';
      this.justConfirmed.set(true);
    } catch (err: unknown) {
      this.error.set((err as { error?: { error?: string } })?.error?.error ?? 'Código incorrecto. Verifica que hayas escaneado el QR correctamente.');
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

  goBack(): void {
    if (this.totpEnabled()) {
      // TOTP activo → puede volver al panel
      this.router.navigate([ROUTES.COMPANIES]);
    } else {
      // Sin TOTP el adminGuard bloquea todas las rutas — cerrar sesión
      this.authService.logout();
    }
  }
}
