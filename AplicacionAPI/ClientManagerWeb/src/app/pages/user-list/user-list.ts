import { Component, OnInit, DestroyRef, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { User } from '../../models/user.model';
import { Company, PagedResponse } from '../../models/company.model';
import { UserService } from '../../services/user.service';
import { CompanyService } from '../../services/company.service';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatPaginatorModule,
    MatIcon, MatTooltip
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss'
})
export class UserListComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private userService    = inject(UserService);
  private companyService = inject(CompanyService);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  private snackBar       = inject(MatSnackBar);
  private dialog         = inject(MatDialog);

  users      = signal<User[]>([]);
  companies  = signal<Company[]>([]);
  totalItems = signal(0);
  totalPages = signal(0);
  isLoading  = signal(false);
  companyFilter           = signal<number | null>(null);
  isCompanyDropdownOpen   = signal(false);
  appliedNameFilter       = signal('');

  pageTitle = computed(() => {
    const compId = this.companyFilter();
    if (!compId) return 'Usuarios totales';
    const company = this.companies().find(c => c.id === compId);
    return company ? `Usuarios de ${company.name}` : 'Usuarios';
  });

  selectedCompanyName = computed(() => {
    const id = this.companyFilter();
    if (!id) return 'Todas las empresas';
    return this.companies().find(c => c.id === id)?.name ?? 'Todas las empresas';
  });

  selectCompany(id: number | null): void {
    this.companyFilter.set(id);
    this.isCompanyDropdownOpen.set(false);
    this.onFilterChange();
  }

  currentPage           = 1;
  pageSize              = 9;
  pageSizeOptions       = [5, 9, 25];
  nameFilter            = '';
  skeletonRows          = [1, 2, 3, 4, 5];
  private nameSearch$   = new Subject<string>();

  ngOnInit(): void {
    const companyId = this.route.snapshot.queryParamMap.get('companyId');
    if (companyId) this.companyFilter.set(Number(companyId));

    this.nameSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.onFilterChange());

    this.loadCompanies();
    this.loadUsers();
  }

  onNameInput(value: string): void {
    this.nameFilter = value;
    this.nameSearch$.next(value);
  }

  loadCompanies(): void {
    this.companyService.getAll(1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.companies.set(r.data) });
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.userService.getAll(this.currentPage, this.pageSize, this.nameFilter || undefined, this.companyFilter() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: PagedResponse<User>) => {
          this.users.set(response.data);
          this.totalItems.set(response.totalItems);
          this.totalPages.set(response.totalPages);
          this.currentPage = response.currentPage;
          this.isLoading.set(false);
        },
        error: () => {
          this.showSnackBar('Error al cargar los usuarios', true);
          this.isLoading.set(false);
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize    = event.pageSize;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.appliedNameFilter.set(this.nameFilter);
    this.loadUsers();
  }

  clearFilters(): void {
    this.nameFilter         = '';
    this.appliedNameFilter.set('');
    this.companyFilter.set(null);
    this.currentPage        = 1;
    this.loadUsers();
  }

  viewUser(id: number): void { this.router.navigate([ROUTES.userDetail(id)]); }
  editUser(id: number): void { this.router.navigate([ROUTES.userEdit(id)]); }
  newUser(): void             { this.router.navigate([ROUTES.USER_NEW]); }

  deleteUser(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { title: 'Eliminar usuario', message: `¿Estás seguro de que deseas eliminar a "${user.name}"?` }
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed) {
          this.userService.delete(user.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next:  () => { this.showSnackBar('Usuario eliminado correctamente'); this.loadUsers(); },
              error: () =>   this.showSnackBar('Error al eliminar el usuario', true)
            });
        }
      });
  }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success'],
      verticalPosition: 'top',
      horizontalPosition: 'center'
    });
  }
}
