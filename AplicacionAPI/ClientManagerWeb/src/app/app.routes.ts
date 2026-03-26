import { Routes } from '@angular/router';
import { ClientListComponent } from './pages/client-list/client-list';
import { ClientFormComponent } from './pages/client-form/client-form';
import { ClientDetailComponent } from './pages/client-detail/client-detail';
import { NotFoundComponent } from './pages/not-found/not-found';

export const routes: Routes = [
  { path: '', redirectTo: 'clientes', pathMatch: 'full' },
  { path: 'clientes', component: ClientListComponent },
  { path: 'clientes/nuevo', component: ClientFormComponent },
  { path: 'clientes/:id/editar', component: ClientFormComponent },
  { path: 'clientes/:id', component: ClientDetailComponent },
  { path: '**', component: NotFoundComponent }
];
