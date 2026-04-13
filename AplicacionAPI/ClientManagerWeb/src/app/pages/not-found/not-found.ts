import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [MatButton, MatIcon],
  template: `
    <div class="not-found">
      <h1>404</h1>
      <p>Página no encontrada</p>
      <button mat-raised-button color="primary" (click)="goHome()">
        <mat-icon>home</mat-icon>
        Volver a Clientes
      </button>
    </div>
  `,
  styles: [`
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 60vh;
      text-align: center;

      h1 {
        font-size: 6rem;
        margin: 0;
        color: var(--mat-sys-primary);
        font-weight: 300;
      }

      p {
        font-size: 1.3rem;
        color: var(--mat-sys-on-surface-variant);
        margin-bottom: 32px;
      }
    }
  `]
})
export class NotFoundComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate([ROUTES.COMPANIES]);
  }
}
