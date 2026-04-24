import { Component, OnInit, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Company, CompanyStatus, COMPANY_STATUS_LABELS, PagedResponse } from '../../models/company.model';
import { User } from '../../models/user.model';
import { CompanyService } from '../../services/company.service';
import { UserService } from '../../services/user.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { ROUTES } from '../../app.routes.constants';

type PanelTab = 'resumen' | 'usuarios' | 'info' | 'config';

@Component({
  selector: 'app-company-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatPaginatorModule, MatMenuModule,
    MatIcon
  ],
  templateUrl: './company-list.html',
  styleUrl: './company-list.scss'
})
export class CompanyListComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private companyService = inject(CompanyService);
  private userService    = inject(UserService);
  private router         = inject(Router);
  private snackBar       = inject(MatSnackBar);
  private dialog         = inject(MatDialog);

  companies           = signal<Company[]>([]);
  totalItems          = signal(0);
  totalPages          = signal(0);
  isLoading           = signal(false);
  selectedCompany     = signal<Company | null>(null);
  activeTab           = signal<PanelTab>('resumen');
  isClosing           = signal(false);
  panelUsers          = signal<User[]>([]);
  isPanelUsersLoading = signal(false);

  private closingTimeout?: ReturnType<typeof setTimeout>;

  currentPage     = 1;
  pageSize        = 10;
  pageSizeOptions = [5, 10, 25];
  nameFilter      = '';
  skeletonRows    = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoading.set(true);
    this.companyService.getAll(this.currentPage, this.pageSize, this.nameFilter || undefined)
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
    this.nameFilter  = '';
    this.currentPage = 1;
    this.loadCompanies();
  }

  selectCompany(company: Company): void {
    clearTimeout(this.closingTimeout);
    this.isClosing.set(false);

    if (this.selectedCompany()?.id === company.id) {
      this.closePanel();
    } else {
      this.selectedCompany.set(company);
      this.activeTab.set('resumen');
      this.panelUsers.set([]);
    }
  }

  closePanel(): void {
    this.isClosing.set(true);
    this.closingTimeout = setTimeout(() => {
      this.selectedCompany.set(null);
      this.isClosing.set(false);
    }, 280);
  }

  setTab(tab: PanelTab): void {
    this.activeTab.set(tab);
    if (tab === 'usuarios') this.loadPanelUsers();
  }

  loadPanelUsers(): void {
    const company = this.selectedCompany();
    if (!company) return;
    this.isPanelUsersLoading.set(true);
    this.panelUsers.set([]);
    this.userService.getAll(1, 8, undefined, company.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => { this.panelUsers.set(r.data); this.isPanelUsersLoading.set(false); },
        error: () => this.isPanelUsersLoading.set(false)
      });
  }

  viewUser(id: number): void { this.router.navigate([ROUTES.userDetail(id)]); }

  viewCompanyUsers(companyId: number): void {
    this.router.navigate([ROUTES.USERS], { queryParams: { companyId } });
  }

  viewCompany(id: number): void  { this.router.navigate([ROUTES.companyDetail(id)]); }
  editCompany(id: number): void  { this.router.navigate([ROUTES.companyEdit(id)]); }
  newCompany(): void              { this.router.navigate([ROUTES.COMPANY_NEW]); }

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
              next: () => {
                if (this.selectedCompany()?.id === company.id) this.selectedCompany.set(null);
                this.showSnackBar('Empresa eliminada correctamente');
                this.loadCompanies();
              },
              error: () => this.showSnackBar('Error al eliminar la empresa', true)
            });
        }
      });
  }

  generateDomain(name: string): string {
    return name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) + '.com';
  }

  formatDate(dateStr: string, style: 'short' | 'long' = 'short'): string {
    const opts: Intl.DateTimeFormatOptions = style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('es-ES', opts);
  }

  statusLabel(status: CompanyStatus): string {
    return COMPANY_STATUS_LABELS[status] ?? status;
  }

  statusClass(status: CompanyStatus): string {
    return { Active: 'active', Prospect: 'pending', Inactive: 'inactive', Churned: 'churned' }[status] ?? 'active';
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
