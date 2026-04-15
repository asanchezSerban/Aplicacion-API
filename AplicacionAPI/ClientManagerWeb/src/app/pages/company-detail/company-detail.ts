import { Component, OnInit, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgClass } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { Company } from '../../models/company.model';
import { CompanyService } from '../../services/company.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-company-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, NgClass,
    MatButton, MatIcon, MatProgressSpinner,
    MatCardModule, MatChipsModule
  ],
  templateUrl: './company-detail.html',
  styleUrl: './company-detail.scss'
})
export class CompanyDetailComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private companyService = inject(CompanyService);
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);

  company   = signal<Company | null>(null);
  isLoading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.companyService.getById(+id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (company) => { this.company.set(company); this.isLoading.set(false); },
          error: () => { this.isLoading.set(false); this.router.navigate([ROUTES.COMPANIES]); }
        });
    }
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Active: 'status-active', Inactive: 'status-inactive',
      Prospect: 'status-prospect', Churned: 'status-churned'
    };
    return map[status] || '';
  }

  editCompany(): void {
    const c = this.company();
    if (c) this.router.navigate([ROUTES.companyEdit(c.id)]);
  }

  goBack(): void { this.router.navigate([ROUTES.COMPANIES]); }
}
