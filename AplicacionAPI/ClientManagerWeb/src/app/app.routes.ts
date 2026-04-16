import { Routes } from '@angular/router';
import { CompanyListComponent } from './pages/company-list/company-list';
import { CompanyFormComponent } from './pages/company-form/company-form';
import { CompanyDetailComponent } from './pages/company-detail/company-detail';
import { UserListComponent } from './pages/user-list/user-list';
import { UserFormComponent } from './pages/user-form/user-form';
import { UserDetailComponent } from './pages/user-detail/user-detail';
import { NotFoundComponent } from './pages/not-found/not-found';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'empresas', pathMatch: 'full' },

  // Companies — solo SuperAdmin
  { path: 'empresas',            component: CompanyListComponent,   canActivate: [authGuard, adminGuard] },
  { path: 'empresas/nueva',      component: CompanyFormComponent,   canActivate: [authGuard, adminGuard] },
  { path: 'empresas/:id/editar', component: CompanyFormComponent,   canActivate: [authGuard, adminGuard] },
  { path: 'empresas/:id',        component: CompanyDetailComponent, canActivate: [authGuard, adminGuard] },

  // Users — solo SuperAdmin
  { path: 'usuarios',            component: UserListComponent,      canActivate: [authGuard, adminGuard] },
  { path: 'usuarios/nuevo',      component: UserFormComponent,      canActivate: [authGuard, adminGuard] },
  { path: 'usuarios/:id/editar', component: UserFormComponent,      canActivate: [authGuard, adminGuard] },
  { path: 'usuarios/:id',        component: UserDetailComponent,    canActivate: [authGuard, adminGuard] },

  // Login — público
  { path: 'login',              loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent),                                             canActivate: [guestGuard] },
  { path: 'mfa-verificar',      loadComponent: () => import('./pages/mfa-verificar/mfa-verificar').then(m => m.MfaVerificarComponent),                     canActivate: [guestGuard] },
  { path: 'recuperar-password', loadComponent: () => import('./pages/recuperar-password/recuperar-password').then(m => m.RecuperarPasswordComponent),       canActivate: [guestGuard] },
  { path: 'reset-password',     loadComponent: () => import('./pages/reset-password/reset-password').then(m => m.ResetPasswordComponent),                   canActivate: [guestGuard] },

  // Perfil — solo Cliente autenticado
  { path: 'perfil', loadComponent: () => import('./pages/perfil/perfil').then(m => m.PerfilComponent), canActivate: [authGuard] },

  { path: '**', component: NotFoundComponent },
];
