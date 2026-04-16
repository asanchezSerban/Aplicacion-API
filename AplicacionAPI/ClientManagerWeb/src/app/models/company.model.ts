export interface Company {
  id: number;
  name: string;
  description: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
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
