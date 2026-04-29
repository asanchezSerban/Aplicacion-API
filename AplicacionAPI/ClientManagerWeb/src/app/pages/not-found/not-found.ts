import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="shell">
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
          <h2>Parece que te has perdido.</h2>
          <p>La página que buscas no existe o fue movida. Vuelve al inicio para continuar.</p>
        </div>
      </aside>

      <main class="content-panel">
        <div class="content">
          <div class="code">404</div>
          <h1>Página no encontrada</h1>
          <p>La URL que has introducido no corresponde a ninguna página de la aplicación.</p>
          <button class="btn-home" (click)="goHome()">
            <mat-icon>arrow_back</mat-icon>
            <span>Volver al inicio</span>
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      min-height: 100vh;
      background: #fff;
    }

    /* Brand panel */
    .brand-panel {
      width: 420px;
      min-width: 420px;
      background: linear-gradient(160deg, #0B0F1A 0%, #111827 60%, #1a1f35 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 2.5rem;
      position: relative;
      overflow: hidden;
    }
    .brand-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }
    .brand-glow--one {
      width: 300px; height: 300px;
      background: rgba(79, 70, 229, 0.2);
      top: -80px; left: -80px;
    }
    .brand-glow--two {
      width: 200px; height: 200px;
      background: rgba(6, 182, 212, 0.12);
      bottom: 60px; right: -40px;
    }
    .brand-top {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      position: relative;
    }
    .brand-mark {
      width: 36px; height: 36px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.9);
    }
    .brand-name {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: rgba(255,255,255,0.9);
    }
    .brand-copy {
      position: relative;
      padding-bottom: 1rem;
    }
    .brand-copy h2 {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
      margin-bottom: 0.75rem;
    }
    .brand-copy p {
      color: rgba(255,255,255,0.5);
      font-size: 0.9rem;
      line-height: 1.6;
    }

    /* Content panel */
    .content-panel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
    }
    .content {
      max-width: 400px;
      width: 100%;
    }
    .code {
      font-size: 7rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 1;
      background: linear-gradient(135deg, #4f46e5, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }
    .content h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }
    .content p {
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .btn-home {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 0.75rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      font-family: inherit;
    }
    .btn-home:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }
    .btn-home mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* Dark mode */
    :host-context(body.dark-mode) .shell { background: #0b0f1a; }
    :host-context(body.dark-mode) .content h1 { color: #f1f5f9; }
    :host-context(body.dark-mode) .content p { color: #94a3b8; }
    :host-context(body.dark-mode) .btn-home { background: #fff; color: #0f172a; }
    :host-context(body.dark-mode) .btn-home:hover { background: #e2e8f0; }

    /* Responsive */
    @media (max-width: 768px) {
      .brand-panel { display: none; }
      .content-panel { padding: 2rem; }
    }
  `]
})
export class NotFoundComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  goHome(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate([ROUTES.LOGIN]);
    } else if (this.authService.userRole() === 'SuperAdmin') {
      this.router.navigate([ROUTES.COMPANIES]);
    } else {
      this.router.navigate([ROUTES.PERFIL]);
    }
  }
}
