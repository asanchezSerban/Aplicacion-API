import { Routes } from '@angular/router';
import { CompanyListComponent } from './pages/company-list/company-list';
import { CompanyFormComponent } from './pages/company-form/company-form';
import { CompanyDetailComponent } from './pages/company-detail/company-detail';
import { ClientListComponent } from './pages/client-list/client-list';
import { ClientFormComponent } from './pages/client-form/client-form';
import { ClientDetailComponent } from './pages/client-detail/client-detail';
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

  // Clients — solo SuperAdmin
  { path: 'clientes',            component: ClientListComponent,    canActivate: [authGuard, adminGuard] },
  { path: 'clientes/nuevo',      component: ClientFormComponent,    canActivate: [authGuard, adminGuard] },
  { path: 'clientes/:id/editar', component: ClientFormComponent,    canActivate: [authGuard, adminGuard] },
  { path: 'clientes/:id',        component: ClientDetailComponent,  canActivate: [authGuard, adminGuard] },

  // Login — público
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent), canActivate: [guestGuard] },

  // Perfil — solo Cliente autenticado
  { path: 'perfil', loadComponent: () => import('./pages/perfil/perfil').then(m => m.PerfilComponent), canActivate: [authGuard] },

  { path: '**', component: NotFoundComponent },
];
