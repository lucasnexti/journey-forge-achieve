import { z } from "zod";

export const phoneDigits = (value: string) => value.replace(/\D/g, "");
export function maskPhone(value: string) {
  const digits = phoneDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const local = digits.slice(2);
  const split = digits.length > 10 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? `-${local.slice(split)}` : ""}`;
}

export const personalDataSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome completo.").max(255, "Use até 255 caracteres."),
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido, como nome@empresa.com.").max(255, "Use até 255 caracteres."),
  telefone: z.string().trim().min(1, "Informe seu telefone com DDD.").transform(phoneDigits).refine(v => /^[1-9][0-9]([2-5][0-9]{7}|9[0-9]{8})$/.test(v), "Informe um telefone fixo ou celular válido com DDD."),
  workplace_empresa: z.string().trim().min(1, "Informe a empresa em que trabalha.").max(255, "Use até 255 caracteres."),
  cargo: z.string().trim().max(255, "Use até 255 caracteres."),
});