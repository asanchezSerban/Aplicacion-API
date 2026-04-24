export type CompanyStatus = 'Prospect' | 'Active' | 'Inactive' | 'Churned';

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  Prospect: 'Prospecto',
  Active:   'Activa',
  Inactive: 'Inactiva',
  Churned:  'Perdida'
};

export interface Company {
  id: number;
  name: string;
  description: string;
  logoUrl: string | null;
  status: CompanyStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
}

export interface CreateCompany {
  name: string;
  description: string;
  logo?: File;
}

export interface UpdateCompany {
  name: string;
  description: string;
  logo?: File;
}

export interface PagedResponse<T> {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
