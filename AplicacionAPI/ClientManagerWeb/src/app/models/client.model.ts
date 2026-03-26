export enum ClientStatus {
  Active = 'Active',
  Inactive = 'Inactive',
  Prospect = 'Prospect',
  Churned = 'Churned'
}

export interface Client {
  id: number;
  name: string;
  description: string;
  logoUrl: string | null;
  status: ClientStatus;
  statusName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClient {
  name: string;
  description: string;
  status: ClientStatus;
  logo?: File;
}

export interface UpdateClient {
  name: string;
  description: string;
  status: ClientStatus;
  logo?: File;
}

export interface UpdateStatus {
  status: ClientStatus;
}

export interface PagedResponse<T> {
  data: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
