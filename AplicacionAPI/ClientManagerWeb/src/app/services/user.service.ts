import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, CreateUser, UpdateUser } from '../models/user.model';
import { PagedResponse } from '../models/company.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http   = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getAll(page: number, pageSize: number, name?: string, companyId?: number): Observable<PagedResponse<User>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (name) params = params.set('name', name);
    if (companyId) params = params.set('companyId', companyId);

    return this.http.get<PagedResponse<User>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateUser): Observable<User> {
    return this.http.post<User>(this.apiUrl, dto);
  }

  update(id: number, dto: UpdateUser): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }
}
