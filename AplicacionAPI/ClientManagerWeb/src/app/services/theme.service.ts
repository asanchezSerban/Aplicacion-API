import { Injectable } from '@angular/core';

type Theme = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  setTheme(theme: Theme) {
    const body = document.body;

    body.classList.remove('dark-mode', 'light-mode');

    if (theme === 'dark') {
      body.classList.add('dark-mode');
    } else if (theme === 'light') {
      body.classList.add('light-mode');
    }

    localStorage.setItem('theme', theme);
  }

  initTheme() {
    const saved = (localStorage.getItem('theme') as Theme) || 'system';
    this.setTheme(saved);
  }
}