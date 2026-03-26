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
import { ClientStatus } from '../../models/client.model';
import { ClientService } from '../../services/client';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButton, MatProgressSpinner, MatCardModule
  ],
  templateUrl: './client-form.html',
  styleUrl: './client-form.scss'
})
export class ClientFormComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  selectedFile: File | null = null;
  currentLogoUrl: string | null = null;
  isLoading = false;
  isEditMode = false;
  clientId!: number;
  statuses = Object.values(ClientStatus);

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
      status: [ClientStatus.Prospect, Validators.required]
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.clientId = +id;
      this.loadClient();
    }
  }

  private loadClient(): void {
    this.isLoading = true;
    this.clientService.getById(this.clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (client) => {
          this.form.patchValue({
            name: client.name,
            description: client.description,
            status: client.status
          });
          this.currentLogoUrl = client.logoUrl;
          this.isLoading = false;
        },
        error: () => {
          this.showSnackBar('Error al cargar el cliente', true);
          this.isLoading = false;
          this.router.navigate([ROUTES.CLIENTS]);
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
      ? this.clientService.update(this.clientId, dto)
      : this.clientService.create(dto);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showSnackBar(this.isEditMode ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente');
          this.router.navigate([ROUTES.CLIENTS]);
        },
        error: () => {
          this.showSnackBar('Error al guardar el cliente', true);
          this.isLoading = false;
        }
      });
  }

  cancel(): void {
    this.router.navigate([ROUTES.CLIENTS]);
  }

  private showSnackBar(message: string, isError = false): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      panelClass: isError ? ['snackbar-error'] : ['snackbar-success']
    });
  }
}
