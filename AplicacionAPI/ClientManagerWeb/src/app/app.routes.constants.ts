export const ROUTES = {
  // Companies (empresas)
  COMPANIES: '/empresas',
  COMPANY_NEW: '/empresas/nueva',
  companyDetail: (id: number) => `/empresas/${id}`,
  companyEdit: (id: number) => `/empresas/${id}/editar`,

  // Users (usuarios asignados a empresas)
  USERS: '/usuarios',
  USER_NEW: '/usuarios/nuevo',
  userDetail: (id: number) => `/usuarios/${id}`,
  userEdit: (id: number) => `/usuarios/${id}/editar`,
};
