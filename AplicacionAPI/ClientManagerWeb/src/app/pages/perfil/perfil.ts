import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-perfil',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule],
  template: `
    <div class="perfil-wrapper">

      @if (loading()) {
        <mat-spinner />
      } @else if (client()) {
        <mat-card class="perfil-card">
          <mat-card-header>
            <div class="perfil-avatar">
              {{ initials() }}
            </div>
            <mat-card-title>{{ client()!.name }}</mat-card-title>
            <mat-card-subtitle>Cliente</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="perfil-field">
              <mat-icon>mail_outline</mat-icon>
              <span>{{ client()!.email }}</span>
            </div>
            <div class="perfil-field">
              <mat-icon>business</mat-icon>
              <span>{{ client()!.companyName }}</span>
            </div>
            <div class="perfil-field">
              <mat-icon>calendar_today</mat-icon>
              <span>Cliente desde {{ client()!.createdAt | date:'MMMM yyyy' }}</span>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button (click)="authService.logout()">
              <mat-icon>logout</mat-icon> Cerrar sesión
            </button>
          </mat-card-actions>
        </mat-card>
      } @else if (error()) {
        <p class="perfil-error">{{ error() }}</p>
      }

    </div>
  `,
  styles: [`
    .perfil-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .perfil-card {
      width: 100%;
      max-width: 420px;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .perfil-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-size: 1.25rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .perfil-field {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface);

      mat-icon { color: var(--mat-sys-on-surface-variant); }
    }

    .perfil-field:last-child { border-bottom: none; }

    .perfil-error {
      color: var(--mat-sys-error);
      text-align: center;
    }
  `]
})
export class PerfilComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);

  client  = signal<User | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);

  initials = () => {
    const name = this.client()?.name ?? '';
    return name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  };

  ngOnInit(): void {
    this.userService.getMe().subscribe({
      next:  (u: User) => { this.client.set(u);  this.loading.set(false); },
      error: ()        => { this.error.set('No se pudieron cargar tus datos.'); this.loading.set(false); }
    });
  }
}
