export interface PasswordRule {
  label: string;
  test:  (p: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Mínimo 8 caracteres',          test: p => p.length >= 8 },
  { label: 'Al menos una mayúscula',        test: p => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula',        test: p => /[a-z]/.test(p) },
  { label: 'Al menos un número',            test: p => /[0-9]/.test(p) },
  { label: 'Al menos un carácter especial', test: p => /[^A-Za-z0-9]/.test(p) }
];
