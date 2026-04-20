import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLES } from '../constants/roles';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (!authService.isLoggedIn()) return true;

  // Redirigir al home según el rol para no crear bucles con adminGuard
  const home = authService.userRole() === ROLES.SUPER_ADMIN ? '/empresas' : '/perfil';
  return router.createUrlTree([home]);
};
