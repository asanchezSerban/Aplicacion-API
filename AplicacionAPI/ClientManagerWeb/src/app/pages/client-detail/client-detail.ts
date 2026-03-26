import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Client } from '../../models/client.model';
import { ClientService } from '../../services/client';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    DatePipe, NgClass,
    MatButton, MatIcon, MatProgressSpinner,
    MatCardModule, MatChipsModule
  ],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss'
})
export class ClientDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  client: Client | null = null;
  isLoading = true;

  constructor(
    private clientService: ClientService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.clientService.getById(+id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (client) => {
            this.client = client;
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
            this.router.navigate([ROUTES.CLIENTS]);
          }
        });
    }
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Active: 'status-active',
      Inactive: 'status-inactive',
      Prospect: 'status-prospect',
      Churned: 'status-churned'
    };
    return map[status] || '';
  }

  editClient(): void {
    if (this.client) {
      this.router.navigate([ROUTES.clientEdit(this.client.id)]);
    }
  }

  goBack(): void {
    this.router.navigate([ROUTES.CLIENTS]);
  }
}
