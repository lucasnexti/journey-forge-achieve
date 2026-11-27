/** Provedores de e-mail pessoal recusados no cadastro (mesma lista do servidor: public.is_corporate_email). */
export const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br", "live.com", "live.com.br",
  "msn.com", "yahoo.com", "yahoo.com.br", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "bol.com.br",
  "uol.com.br", "terra.com.br", "ig.com.br", "globo.com", "globomail.com", "r7.com", "zipmail.com.br", "protonmail.com",
  "proton.me", "gmx.com", "mail.com", "yandex.com", "zoho.com", "tutanota.com",
] as const;

export const CORPORATE_EMAIL_MESSAGE =
  "Cadastro permitido apenas com e-mail corporativo. E-mails pessoais (como Gmail, Hotmail, Outlook ou Yahoo) não são aceitos.";

export function isCorporateEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return !(PERSONAL_EMAIL_DOMAINS as readonly string[]).includes(domain);
}
