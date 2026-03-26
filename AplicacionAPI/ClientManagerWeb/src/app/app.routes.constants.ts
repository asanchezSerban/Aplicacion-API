export const ROUTES = {
  CLIENTS: '/clientes',
  CLIENT_NEW: '/clientes/nuevo',
  clientDetail: (id: number) => `/clientes/${id}`,
  clientEdit: (id: number) => `/clientes/${id}/editar`,
};
