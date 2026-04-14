export interface User {
  id: number;
  name: string;
  email: string;
  companyId: number;
  companyName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUser {
  name: string;
  email: string;
  companyId: number;
  password: string;
}

export interface UpdateUser {
  name: string;
  email: string;
  companyId: number;
}
