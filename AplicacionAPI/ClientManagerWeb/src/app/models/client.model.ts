export interface Client {
  id: number;
  name: string;
  email: string;
  companyId: number;
  companyName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClient {
  name: string;
  email: string;
  companyId: number;
}

export interface UpdateClient {
  name: string;
  email: string;
  companyId: number;
}
