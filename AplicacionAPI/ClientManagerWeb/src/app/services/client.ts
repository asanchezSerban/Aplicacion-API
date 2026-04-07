import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client, CreateClient, UpdateClient } from '../models/client.model';
import { PagedResponse } from '../models/company.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly apiUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(page: number, pageSize: number, name?: string, companyId?: number): Observable<PagedResponse<Client>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (name) params = params.set('name', name);
    if (companyId) params = params.set('companyId', companyId);

    return this.http.get<PagedResponse<Client>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateClient): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, dto);
  }

  update(id: number, dto: UpdateClient): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
