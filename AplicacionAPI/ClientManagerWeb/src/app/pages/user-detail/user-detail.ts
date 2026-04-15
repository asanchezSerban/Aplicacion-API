import { Component, OnInit, DestroyRef, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-user-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButton, MatIcon, MatProgressSpinner,
    MatCardModule
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss'
})
export class UserDetailComponent implements OnInit {
  private destroyRef  = inject(DestroyRef);
  private userService = inject(UserService);
  private route       = inject(ActivatedRoute);
  private router      = inject(Router);

  user      = signal<User | null>(null);
  isLoading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.userService.getById(+id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (user) => { this.user.set(user); this.isLoading.set(false); },
          error: () => { this.isLoading.set(false); this.router.navigate([ROUTES.USERS]); }
        });
    }
  }

  editUser(): void {
    const u = this.user();
    if (u) this.router.navigate([ROUTES.userEdit(u.id)]);
  }

  goBack(): void { this.router.navigate([ROUTES.USERS]); }
}
