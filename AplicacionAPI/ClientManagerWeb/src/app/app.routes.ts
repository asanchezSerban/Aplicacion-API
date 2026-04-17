import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'empresas', pathMatch: 'full' },

  // Companies — solo SuperAdmin
  { path: 'empresas',            loadComponent: () => import('./pages/company-list/company-list').then(m => m.CompanyListComponent),     canActivate: [authGuard, adminGuard] },
  { path: 'empresas/nueva',      loadComponent: () => import('./pages/company-form/company-form').then(m => m.CompanyFormComponent),     canActivate: [authGuard, adminGuard] },
  { path: 'empresas/:id/editar', loadComponent: () => import('./pages/company-form/company-form').then(m => m.CompanyFormComponent),     canActivate: [authGuard, adminGuard] },
  { path: 'empresas/:id',        loadComponent: () => import('./pages/company-detail/company-detail').then(m => m.CompanyDetailComponent), canActivate: [authGuard, adminGuard] },

  // Users — solo SuperAdmin
  { path: 'usuarios',            loadComponent: () => import('./pages/user-list/user-list').then(m => m.UserListComponent),       canActivate: [authGuard, adminGuard] },
  { path: 'usuarios/nuevo',      loadComponent: () => import('./pages/user-form/user-form').then(m => m.UserFormComponent),       canActivate: [authGuard, adminGuard] },
  { path: 'usuarios/:id/editar', loadComponent: () => import('./pages/user-form/user-form').then(m => m.UserFormComponent),       canActivate: [authGuard, adminGuard] },
  { path: 'usuarios/:id',        loadComponent: () => import('./pages/user-detail/user-detail').then(m => m.UserDetailComponent), canActivate: [authGuard, adminGuard] },

  // Público
  { path: 'login',              loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),                                           canActivate: [guestGuard] },
  { path: 'mfa-verificar',      loadComponent: () => import('./pages/mfa-verificar/mfa-verificar').then(m => m.MfaVerificarComponent),                   canActivate: [guestGuard] },
  { path: 'recuperar-password', loadComponent: () => import('./pages/recuperar-password/recuperar-password').then(m => m.RecuperarPasswordComponent),     canActivate: [guestGuard] },
  { path: 'reset-password',     loadComponent: () => import('./pages/reset-password/reset-password').then(m => m.ResetPasswordComponent),                 canActivate: [guestGuard] },

  // Perfil — solo Cliente autenticado
  { path: 'perfil', loadComponent: () => import('./pages/perfil/perfil').then(m => m.PerfilComponent), canActivate: [authGuard] },

  // Configurar TOTP — cualquier usuario autenticado
  { path: 'configurar-totp', loadComponent: () => import('./pages/configurar-totp/configurar-totp').then(m => m.ConfigurarTotpComponent), canActivate: [authGuard] },

  { path: '**', loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFoundComponent) },
];
