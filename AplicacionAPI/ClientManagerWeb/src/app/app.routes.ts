import { Routes } from '@angular/router';
import { CompanyListComponent } from './pages/company-list/company-list';
import { CompanyFormComponent } from './pages/company-form/company-form';
import { CompanyDetailComponent } from './pages/company-detail/company-detail';
import { ClientListComponent } from './pages/client-list/client-list';
import { ClientFormComponent } from './pages/client-form/client-form';
import { ClientDetailComponent } from './pages/client-detail/client-detail';
import { NotFoundComponent } from './pages/not-found/not-found';

export const routes: Routes = [
  { path: '', redirectTo: 'empresas', pathMatch: 'full' },

  // Companies
  { path: 'empresas', component: CompanyListComponent },
  { path: 'empresas/nueva', component: CompanyFormComponent },
  { path: 'empresas/:id/editar', component: CompanyFormComponent },
  { path: 'empresas/:id', component: CompanyDetailComponent },

  // Clients
  { path: 'clientes', component: ClientListComponent },
  { path: 'clientes/nuevo', component: ClientFormComponent },
  { path: 'clientes/:id/editar', component: ClientFormComponent },
  { path: 'clientes/:id', component: ClientDetailComponent },

  { path: '**', component: NotFoundComponent }
];
