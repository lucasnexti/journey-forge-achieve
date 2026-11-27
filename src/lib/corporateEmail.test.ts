import { isCorporateEmail } from "./corporateEmail";
test("aceita e-mail corporativo", () => {
  expect(isCorporateEmail("robson@nexti.com")).toBe(true);
  expect(isCorporateEmail("ana@cliente.com.br")).toBe(true);
});
test("recusa e-mails pessoais", () => {
  for (const e of ["a@gmail.com", "b@Hotmail.com", "c@outlook.com.br", "d@yahoo.com.br", "e@icloud.com", "f@bol.com.br"]) expect(isCorporateEmail(e)).toBe(false);
});
