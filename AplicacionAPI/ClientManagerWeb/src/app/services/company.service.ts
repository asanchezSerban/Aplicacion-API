import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Company, CreateCompany, UpdateCompany, PagedResponse } from '../models/company.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http   = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/companies`;

  getAll(page: number, pageSize: number, name?: string): Observable<PagedResponse<Company>> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (name) params = params.set('name', name);

    return this.http.get<PagedResponse<Company>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateCompany): Observable<Company> {
    return this.http.post<Company>(this.apiUrl, this.toFormData(dto));
  }

  update(id: number, dto: UpdateCompany): Observable<Company> {
    return this.http.put<Company>(`${this.apiUrl}/${id}`, this.toFormData(dto));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private toFormData(dto: CreateCompany | UpdateCompany): FormData {
    const formData = new FormData();
    formData.append('name', dto.name);
    formData.append('description', dto.description);
    if (dto.logo) {
      formData.append('logo', dto.logo);
    }
    return formData;
  }
}
