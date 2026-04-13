import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTooltip } from '@angular/material/tooltip';
import { ROUTES } from '../../app.routes.constants';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbar, MatButton, MatIconButton, MatIcon, MatSlideToggle, MatTooltip],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent {
  private readonly router = inject(Router);
  readonly authService    = inject(AuthService);

  isDarkMode = false;

  readonly routes = ROUTES;

  navigateToCompanies(): void { this.router.navigate([ROUTES.COMPANIES]); }
  navigateToUsers(): void     { this.router.navigate([ROUTES.USERS]); }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode', this.isDarkMode);
  }
}
