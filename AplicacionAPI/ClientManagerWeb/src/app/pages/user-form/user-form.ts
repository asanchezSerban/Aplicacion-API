import { Component, OnInit, DestroyRef, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Company } from '../../models/company.model';
import { UserService } from '../../services/user.service';
import { CompanyService } from '../../services/company.service';
import { ROUTES } from '../../app.routes.constants';

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Mínimo 8 caracteres',          test: p => p.length >= 8 },
  { label: 'Al menos una mayúscula',        test: p => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula',        test: p => /[a-z]/.test(p) },
  { label: 'Al menos un número',            test: p => /[0-9]/.test(p) },
  { label: 'Al menos un carácter especial', test: p => /[^A-Za-z0-9]/.test(p) },
];

@Component({
  selector: 'app-user-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButton, MatIconButton, MatProgressSpinner, MatCardModule, MatIconModule
  ],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss'
})
export class UserFormComponent implements OnInit {
  private destroyRef     = inject(DestroyRef);
  private fb             = inject(FormBuilder);
  private userService    = inject(UserService);
  private companyService = inject(CompanyService);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  private snackBar       = inject(MatSnackBar);

  form!: FormGroup;
  companies    = signal<Company[]>([]);
  isLoading    = signal(false);
  isEditMode   = false;
  userId!: number;
  showPassword = signal(false);

  private readonly _password = signal('');

  passwordRules = computed(() =>
    PASSWORD_RULES.map(r => ({ label: r.label, ok: r.test(this._password()) }))
  );

  allPasswordValid = computed(() => this.passwordRules().every(r => r.ok));

  get name()      { return this.form.controls['name']; }
  get email()     { return this.form.controls['email']; }
  get companyId() { return this.form.controls['companyId']; }
  get password()  { return this.form.controls['password']; }

  ngOnInit(): void {
    this.form = this.fb.nonNullable.group({
      name:      ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      email:     ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
      companyId: [null as unknown as number, Validators.required],
      password:  ['', Validators.required]
    });

    this.loadCompanies();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.userId     = +id;
      this.loadUser();
      this.form.get('password')!.clearValidators();
      this.form.get('password')!.updateValueAndValidity();
    }
  }

  onPasswordInput(event: Event): void {
    this._password.set((event.target as HTMLInputElement).value);
  }

  private loadCompanies(): void {
    this.companyService.getAll(1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (r) => this.companies.set(r.data) });
  }

  private loadUser(): void {
    this.isLoading.set(true);
    this.userService.getById(this.userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.form.patchValue({ name: user.name, email: user.email, companyId: user.companyId });
          this.isLoading.set(false);
        },
        error: () => {
          this.showSnackBar('Error al cargar el usuario', true);
          this.isLoading.set(false);
          this.router.navigate([ROUTES.USERS]);
        }
      });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    if (!this.isEditMode && !this.allPasswordValid()) return;

    this.isLoading.set(true);
    const dto = this.form.getRawValue();

    const operation = this.isEditMode
      ? this.userService.update(this.userId, { name: dto.name, email: dto.email, companyId: dto.companyId })
      : this.userService.create(dto);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showSnackBar(this.isEditMode ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
          this.router.navigate([ROUTES.USERS]);
        },
        error: (err: any) => {
          const msg = err?.error?.error ?? 'Error al guardar el usuario';
          this.showSnackBar(msg, true);
          this.isLoading.set(false);
        }
      });
  }

  cancel(): void { this.router.navigate([ROUTES.USERS]); }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 4000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
