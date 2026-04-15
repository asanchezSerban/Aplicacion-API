import { Component, OnInit, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatTableModule, MatPaginatorModule, MatProgressSpinner,
    MatButton, MatIconButton, MatIcon,
    MatSelectModule, MatInputModule,
    MatFormFieldModule, MatTooltip
  ],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss'
})
export class UserListComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private userService    = inject(UserService);
  private companyService = inject(CompanyService);
  private router         = inject(Router);
  private snackBar       = inject(MatSnackBar);
  private dialog         = inject(MatDialog);

  users      = signal<User[]>([]);
  companies  = signal<Company[]>([]);
  totalItems = signal(0);
  totalPages = signal(0);
  isLoading  = signal(false);

  currentPage           = 1;
  pageSize              = 10;
  pageSizeOptions       = [5, 10, 25];
  nameFilter            = '';
  companyFilter: number | null = null;

  displayedColumns = ['name', 'email', 'company', 'actions'];

  ngOnInit(): void {
    this.loadCompanies();
    this.loadUsers();
  }

  loadCompanies(): void {
    this.companyService.getAll(1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.companies.set(r.data) });
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.userService.getAll(this.currentPage, this.pageSize, this.nameFilter || undefined, this.companyFilter || undefined)
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
    this.loadUsers();
  }

  clearFilters(): void {
    this.nameFilter    = '';
    this.companyFilter = null;
    this.currentPage   = 1;
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
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
