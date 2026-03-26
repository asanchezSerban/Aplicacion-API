import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client, CreateClient, UpdateClient, UpdateStatus, PagedResponse } from '../models/client.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly apiUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(page: number, pageSize: number, name?: string, status?: string): Observable<PagedResponse<Client>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (name) params = params.set('name', name);
    if (status) params = params.set('status', status);

    return this.http.get<PagedResponse<Client>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Client> {
    return this.http.get<Client>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateClient): Observable<Client> {
    const formData = this.toFormData(dto);
    return this.http.post<Client>(this.apiUrl, formData);
  }

  update(id: number, dto: UpdateClient): Observable<Client> {
    const formData = this.toFormData(dto);
    return this.http.put<Client>(`${this.apiUrl}/${id}`, formData);
  }

  updateStatus(id: number, dto: UpdateStatus): Observable<Client> {
    return this.http.patch<Client>(`${this.apiUrl}/${id}/status`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private toFormData(dto: CreateClient | UpdateClient): FormData {
    const formData = new FormData();
    formData.append('name', dto.name);
    formData.append('description', dto.description);
    formData.append('status', dto.status);
    if (dto.logo) {
      formData.append('logo', dto.logo);
    }
    return formData;
  }
}
