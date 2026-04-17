import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLES } from '../constants/roles';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.userRole() !== ROLES.SUPER_ADMIN) return router.createUrlTree(['/login']);

  // TOTP obligatorio para SuperAdmin — si no está activado, forzar configuración
  if (!authService.totpEnabled()) return router.createUrlTree(['/configurar-totp']);

  return true;
};
