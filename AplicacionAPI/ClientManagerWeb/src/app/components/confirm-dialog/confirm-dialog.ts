import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <div class="dialog-wrap">
      <div class="dialog-icon">
        <mat-icon>warning_amber</mat-icon>
      </div>

      <h2 class="dialog-title">{{ data.title }}</h2>
      <p class="dialog-message">{{ data.message }}</p>

      <div class="dialog-actions">
        <button type="button" class="btn-cancel" [mat-dialog-close]="false">
          Cancelar
        </button>
        <button type="button" class="btn-confirm" [mat-dialog-close]="true">
          Eliminar
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      font-family: 'Inter', system-ui, sans-serif;
    }

    .dialog-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2rem 1.75rem 1.5rem;
      gap: 0;
    }

    .dialog-icon {
      width: 52px; height: 52px;
      border-radius: 14px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      display: grid;
      place-items: center;
      margin-bottom: 1.125rem;

      mat-icon {
        font-size: 26px; width: 26px; height: 26px;
        color: #DC2626;
      }
    }

    .dialog-title {
      font-size: 1.0625rem;
      font-weight: 700;
      color: #0B0F1A;
      margin: 0 0 0.5rem;
      letter-spacing: -0.02em;
    }

    .dialog-message {
      font-size: 0.875rem;
      color: #4B5468;
      margin: 0 0 1.75rem;
      line-height: 1.5;
      max-width: 280px;
    }

    .dialog-actions {
      display: flex;
      gap: 0.75rem;
      width: 100%;
    }

    .btn-cancel {
      flex: 1;
      height: 42px;
      border-radius: 10px;
      border: 1.5px solid #E6E9F0;
      background: transparent;
      color: #1E2638;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 150ms ease;
      &:hover { background: #F5F6FA; }
    }

    .btn-confirm {
      flex: 1;
      height: 42px;
      border-radius: 10px;
      border: none;
      background: #DC2626;
      color: #fff;
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 150ms ease, transform 120ms ease;
      &:hover { background: #B91C1C; }
      &:active { transform: scale(0.97); }
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}
}
