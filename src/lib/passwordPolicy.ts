/** Regra de senha forte para todos os usuários (admins de cliente e comuns). */
export const PASSWORD_RULES = [
  { key: "length", label: "Mínimo de 8 caracteres", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "Um número", test: (p: string) => /\d/.test(p) },
  { key: "special", label: "Um caractere especial (ex.: ! @ # $ %)", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const;

export const PASSWORD_POLICY_MESSAGE =
  "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.";

export const isStrongPassword = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
