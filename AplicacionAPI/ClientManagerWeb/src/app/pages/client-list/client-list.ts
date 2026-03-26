import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltip } from '@angular/material/tooltip';
import { Client, ClientStatus, PagedResponse } from '../../models/client.model';
import { ClientService } from '../../services/client';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    NgClass, FormsModule,
    MatTableModule, MatPaginatorModule, MatProgressSpinner,
    MatButton, MatIconButton, MatIcon,
    MatMenuModule, MatSelectModule, MatInputModule,
    MatFormFieldModule, MatChipsModule, MatTooltip
  ],
  templateUrl: './client-list.html',
  styleUrl: './client-list.scss'
})
export class ClientListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  clients: Client[] = [];
  totalItems = 0;
  totalPages = 0;
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 25];
  isLoading = false;
  nameFilter = '';
  statusFilter = '';

  displayedColumns = ['logo', 'name', 'description', 'status', 'actions'];
  statuses = Object.values(ClientStatus);

  constructor(
    private clientService: ClientService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.isLoading = true;
    this.clientService.getAll(this.currentPage, this.pageSize, this.nameFilter || undefined, this.statusFilter || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: PagedResponse<Client>) => {
          this.clients = response.data;
          this.totalItems = response.totalItems;
          this.totalPages = response.totalPages;
          this.currentPage = response.currentPage;
          this.isLoading = false;
        },
        error: () => {
          this.showSnackBar('Error al cargar los clientes', true);
          this.isLoading = false;
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadClients();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadClients();
  }

  clearFilters(): void {
    this.nameFilter = '';
    this.statusFilter = '';
    this.currentPage = 1;
    this.loadClients();
  }

  viewClient(id: number): void {
    this.router.navigate([ROUTES.clientDetail(id)]);
  }

  editClient(id: number): void {
    this.router.navigate([ROUTES.clientEdit(id)]);
  }

  newClient(): void {
    this.router.navigate([ROUTES.CLIENT_NEW]);
  }

  changeStatus(client: Client, newStatus: ClientStatus): void {
    this.clientService.updateStatus(client.id, { status: newStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showSnackBar('Estado actualizado correctamente');
          this.loadClients();
        },
        error: () => this.showSnackBar('Error al cambiar el estado', true)
      });
  }

  deleteClient(client: Client): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Eliminar cliente',
        message: `¿Estás seguro de que deseas eliminar a "${client.name}"?`
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed) {
          this.clientService.delete(client.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.showSnackBar('Cliente eliminado correctamente');
                this.loadClients();
              },
              error: () => this.showSnackBar('Error al eliminar el cliente', true)
            });
        }
      });
  }

  getStatusClass(status: ClientStatus): string {
    const map: Record<string, string> = {
      Active: 'status-active',
      Inactive: 'status-inactive',
      Prospect: 'status-prospect',
      Churned: 'status-churned'
    };
    return map[status] || '';
  }

  truncate(text: string, length: number = 80): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
