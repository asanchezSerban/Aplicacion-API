import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { CompanyStatus } from '../../models/company.model';
import { CompanyService } from '../../services/company.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-company-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButton, MatProgressSpinner, MatCardModule
  ],
  templateUrl: './company-form.html',
  styleUrl: './company-form.scss'
})
export class CompanyFormComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  selectedFile: File | null = null;
  currentLogoUrl: string | null = null;
  isLoading = false;
  isEditMode = false;
  companyId!: number;
  statuses = Object.values(CompanyStatus);

  constructor(
    private fb: FormBuilder,
    private companyService: CompanyService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      status: [CompanyStatus.Prospect, Validators.required]
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.companyId = +id;
      this.loadCompany();
    }
  }

  private loadCompany(): void {
    this.isLoading = true;
    this.companyService.getById(this.companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (company) => {
          this.form.patchValue({
            name: company.name,
            description: company.description,
            status: company.status
          });
          this.currentLogoUrl = company.logoUrl;
          this.isLoading = false;
        },
        error: () => {
          this.showSnackBar('Error al cargar la empresa', true);
          this.isLoading = false;
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

    this.isLoading = true;
    const formValue = this.form.value;
    const dto = {
      name: formValue.name,
      description: formValue.description,
      status: formValue.status,
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
          this.router.navigate([ROUTES.COMPANIES]);
        },
        error: () => {
          this.showSnackBar('Error al guardar la empresa', true);
          this.isLoading = false;
        }
      });
  }

  cancel(): void {
    this.router.navigate([ROUTES.COMPANIES]);
  }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
