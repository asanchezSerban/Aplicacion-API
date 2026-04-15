import { Component, OnInit, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
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
import { Company, CompanyStatus, PagedResponse } from '../../models/company.model';
import { CompanyService } from '../../services/company.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-company-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass, FormsModule,
    MatTableModule, MatPaginatorModule, MatProgressSpinner,
    MatButton, MatIconButton, MatIcon,
    MatMenuModule, MatSelectModule, MatInputModule,
    MatFormFieldModule, MatChipsModule, MatTooltip
  ],
  templateUrl: './company-list.html',
  styleUrl: './company-list.scss'
})
export class CompanyListComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private companyService = inject(CompanyService);
  private router         = inject(Router);
  private snackBar       = inject(MatSnackBar);
  private dialog         = inject(MatDialog);

  companies  = signal<Company[]>([]);
  totalItems = signal(0);
  totalPages = signal(0);
  isLoading  = signal(false);

  currentPage     = 1;
  pageSize        = 10;
  pageSizeOptions = [5, 10, 25];
  nameFilter      = '';
  statusFilter    = '';

  displayedColumns = ['logo', 'name', 'description', 'status', 'actions'];
  statuses         = Object.values(CompanyStatus);

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoading.set(true);
    this.companyService.getAll(this.currentPage, this.pageSize, this.nameFilter || undefined, this.statusFilter || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: PagedResponse<Company>) => {
          this.companies.set(response.data);
          this.totalItems.set(response.totalItems);
          this.totalPages.set(response.totalPages);
          this.currentPage = response.currentPage;
          this.isLoading.set(false);
        },
        error: () => {
          this.showSnackBar('Error al cargar las empresas', true);
          this.isLoading.set(false);
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize    = event.pageSize;
    this.loadCompanies();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadCompanies();
  }

  clearFilters(): void {
    this.nameFilter   = '';
    this.statusFilter = '';
    this.currentPage  = 1;
    this.loadCompanies();
  }

  viewCompany(id: number): void { this.router.navigate([ROUTES.companyDetail(id)]); }
  editCompany(id: number): void { this.router.navigate([ROUTES.companyEdit(id)]); }
  newCompany(): void             { this.router.navigate([ROUTES.COMPANY_NEW]); }

  changeStatus(company: Company, newStatus: CompanyStatus): void {
    this.companyService.updateStatus(company.id, { status: newStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  () => { this.showSnackBar('Estado actualizado correctamente'); this.loadCompanies(); },
        error: () =>   this.showSnackBar('Error al cambiar el estado', true)
      });
  }

  deleteCompany(company: Company): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { title: 'Eliminar empresa', message: `¿Estás seguro de que deseas eliminar "${company.name}"?` }
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed) {
          this.companyService.delete(company.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next:  () => { this.showSnackBar('Empresa eliminada correctamente'); this.loadCompanies(); },
              error: () =>   this.showSnackBar('Error al eliminar la empresa', true)
            });
        }
      });
  }

  getStatusClass(status: CompanyStatus): string {
    const map: Record<string, string> = {
      Active: 'status-active', Inactive: 'status-inactive',
      Prospect: 'status-prospect', Churned: 'status-churned'
    };
    return map[status] || '';
  }

  truncate(text: string, length = 80): string {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
