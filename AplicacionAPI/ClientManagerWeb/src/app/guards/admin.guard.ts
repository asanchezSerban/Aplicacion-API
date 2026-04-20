import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLES } from '../constants/roles';

export const adminGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  // Usuario autenticado pero sin rol SuperAdmin → llevarle a su página propia
  if (authService.userRole() !== ROLES.SUPER_ADMIN)
    return router.createUrlTree(['/perfil']);

  // TOTP obligatorio para SuperAdmin — si no está activado, forzar configuración
  if (!authService.totpEnabled()) return router.createUrlTree(['/configurar-totp']);

  return true;
};
