import { Component, OnInit, DestroyRef, inject } from '@angular/core';
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
  imports: [
    DatePipe,
    MatButton, MatIcon, MatProgressSpinner,
    MatCardModule
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss'
})
export class UserDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  user: User | null = null;
  isLoading = true;

  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.userService.getById(+id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (user) => {
            this.user = user;
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
            this.router.navigate([ROUTES.USERS]);
          }
        });
    }
  }

  editUser(): void {
    if (this.user) {
      this.router.navigate([ROUTES.userEdit(this.user.id)]);
    }
  }

  goBack(): void {
    this.router.navigate([ROUTES.USERS]);
  }
}
