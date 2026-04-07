export const ROUTES = {
  // Companies (empresas)
  COMPANIES: '/empresas',
  COMPANY_NEW: '/empresas/nueva',
  companyDetail: (id: number) => `/empresas/${id}`,
  companyEdit: (id: number) => `/empresas/${id}/editar`,

  // Clients (clientes asignados a empresas)
  CLIENTS: '/clientes',
  CLIENT_NEW: '/clientes/nuevo',
  clientDetail: (id: number) => `/clientes/${id}`,
  clientEdit: (id: number) => `/clientes/${id}/editar`,
};
