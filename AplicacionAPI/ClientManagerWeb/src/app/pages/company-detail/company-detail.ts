import { Component, OnInit, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltip } from '@angular/material/tooltip';
import { Company } from '../../models/company.model';
import { User } from '../../models/user.model';
import { CompanyService } from '../../services/company.service';
import { UserService } from '../../services/user.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-company-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButton, MatIconButton, MatIcon, MatProgressSpinner,
    MatCardModule, MatTooltip
  ],
  templateUrl: './company-detail.html',
  styleUrl: './company-detail.scss'
})
export class CompanyDetailComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private companyService = inject(CompanyService);
  private userService    = inject(UserService);
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);

  company      = signal<Company | null>(null);
  users        = signal<User[]>([]);
  isLoading    = signal(true);
  usersLoading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const companyId = +id;

    this.companyService.getById(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  (company) => { this.company.set(company); this.isLoading.set(false); },
        error: ()        => { this.isLoading.set(false); this.router.navigate([ROUTES.COMPANIES]); }
      });

    this.userService.getAll(1, 100, undefined, companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  (res) => { this.users.set(res.data); this.usersLoading.set(false); },
        error: ()    => { this.usersLoading.set(false); }
      });
  }

  editCompany(): void {
    const c = this.company();
    if (c) this.router.navigate([ROUTES.companyEdit(c.id)]);
  }

  newUser(): void {
    const c = this.company();
    if (c) this.router.navigate([ROUTES.USER_NEW], { queryParams: { companyId: c.id } });
  }

  editUser(id: number): void {
    const c = this.company();
    if (c) this.router.navigate([ROUTES.userEdit(id)], { queryParams: { companyId: c.id } });
  }

  goBack(): void { this.router.navigate([ROUTES.COMPANIES]); }
}
