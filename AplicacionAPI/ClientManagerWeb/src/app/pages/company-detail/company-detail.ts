import { Component, OnInit, DestroyRef, inject } from '@angular/core';
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
  standalone: true,
  imports: [
    DatePipe, NgClass,
    MatButton, MatIcon, MatProgressSpinner,
    MatCardModule, MatChipsModule
  ],
  templateUrl: './company-detail.html',
  styleUrl: './company-detail.scss'
})
export class CompanyDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  company: Company | null = null;
  isLoading = true;

  constructor(
    private companyService: CompanyService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.companyService.getById(+id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (company) => {
            this.company = company;
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
            this.router.navigate([ROUTES.COMPANIES]);
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

  editCompany(): void {
    if (this.company) {
      this.router.navigate([ROUTES.companyEdit(this.company.id)]);
    }
  }

  goBack(): void {
    this.router.navigate([ROUTES.COMPANIES]);
  }
}
