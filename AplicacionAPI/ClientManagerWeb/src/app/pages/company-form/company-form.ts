import { Component, OnInit, DestroyRef, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '../../services/notification.service';
import { CompanyService } from '../../services/company.service';
import { CompanyStatus, COMPANY_STATUS_LABELS } from '../../models/company.model';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-company-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatIconModule
  ],
  templateUrl: './company-form.html',
  styleUrl: './company-form.scss'
})
export class CompanyFormComponent implements OnInit {
  private destroyRef           = inject(DestroyRef);
  private fb                   = inject(FormBuilder);
  private companyService       = inject(CompanyService);
  private notificationService  = inject(NotificationService);
  private router               = inject(Router);
  private route                = inject(ActivatedRoute);
  private snackBar             = inject(MatSnackBar);

  form!: FormGroup;
  selectedFile: File | null = null;
  currentLogoUrl = signal<string | null>(null);
  isLoading      = signal(false);
  isEditMode     = false;
  companyId!: number;

  readonly statusOptions: { value: CompanyStatus; label: string }[] = [
    { value: 'Prospect', label: COMPANY_STATUS_LABELS.Prospect },
    { value: 'Active',   label: COMPANY_STATUS_LABELS.Active   },
    { value: 'Inactive', label: COMPANY_STATUS_LABELS.Inactive },
    { value: 'Churned',  label: COMPANY_STATUS_LABELS.Churned  },
  ];

  isStatusDropdownOpen = signal(false);
  currentStatus        = signal<CompanyStatus>('Active');

  selectedStatusLabel = computed(() =>
    this.statusOptions.find(o => o.value === this.currentStatus())?.label ?? 'Selecciona estado'
  );

  selectStatus(value: CompanyStatus): void {
    this.currentStatus.set(value);
    this.form.controls['status'].setValue(value);
    this.isStatusDropdownOpen.set(false);
  }

  get name()         { return this.form.controls['name']; }
  get description()  { return this.form.controls['description']; }
  get status()       { return this.form.controls['status']; }
  get contactEmail() { return this.form.controls['contactEmail']; }
  get contactPhone() { return this.form.controls['contactPhone']; }
  get address()      { return this.form.controls['address']; }

  ngOnInit(): void {
    this.form = this.fb.nonNullable.group({
      name:         ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      description:  ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      status:       ['Active' as CompanyStatus],
      contactEmail: ['', [Validators.email, Validators.maxLength(200)]],
      contactPhone: ['', [Validators.maxLength(30)]],
      address:      ['', [Validators.maxLength(300)]]
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.companyId  = +id;
      this.loadCompany();
    }
  }

  private loadCompany(): void {
    this.isLoading.set(true);
    this.companyService.getById(this.companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (company) => {
          this.currentStatus.set(company.status);
          this.form.patchValue({
            name:         company.name,
            description:  company.description,
            status:       company.status,
            contactEmail: company.contactEmail ?? '',
            contactPhone: company.contactPhone ?? '',
            address:      company.address      ?? ''
          });
          this.currentLogoUrl.set(company.logoUrl);
          this.isLoading.set(false);
        },
        error: () => {
          this.showSnackBar('Error al cargar la empresa', true);
          this.isLoading.set(false);
          this.router.navigate([ROUTES.COMPANIES]);
        }
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    const { name, description, status, contactEmail, contactPhone, address } = this.form.getRawValue();
    const dto = {
      name, description, status,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      address:      address      || undefined,
      logo: this.selectedFile || undefined
    };

    const operation = this.isEditMode
      ? this.companyService.update(this.companyId, dto)
      : this.companyService.create(dto);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showSnackBar(this.isEditMode ? 'Empresa actualizada correctamente' : 'Empresa creada correctamente');
          if (!this.isEditMode) {
            this.notificationService.add({
              icon: 'domain', iconColor: '#4F46E5',
              text: name, sub: 'Empresa creada',
              date: new Date().toISOString()
            });
          }
          this.router.navigate([ROUTES.COMPANIES]);
        },
        error: () => {
          this.showSnackBar('Error al guardar la empresa', true);
          this.isLoading.set(false);
        }
      });
  }

  cancel(): void { this.router.navigate([ROUTES.COMPANIES]); }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, undefined, {
      duration: 2000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success'],
      verticalPosition: 'top',
      horizontalPosition: 'center'
    });
  }
}
