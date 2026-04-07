export enum CompanyStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Prospect = 'Prospect',
  Churned = 'Churned'
}

export interface Company {
  id: number;
  name: string;
  description: string;
  logoUrl: string | null;
  status: CompanyStatus;
  statusName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompany {
  name: string;
  description: string;
  status: CompanyStatus;
  logo?: File;
}

export interface UpdateCompany {
  name: string;
  description: string;
  status: CompanyStatus;
  logo?: File;
}

export interface UpdateCompanyStatus {
  status: CompanyStatus;
}

export interface PagedResponse<T> {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
