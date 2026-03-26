import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { ROUTES } from '../../app.routes.constants';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [MatToolbar, MatButton, MatIcon, MatSlideToggle],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent {
  isDarkMode = false;

  constructor(private router: Router) {}

  navigateToClients(): void {
    this.router.navigate([ROUTES.CLIENTS]);
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-mode', this.isDarkMode);
  }
}
