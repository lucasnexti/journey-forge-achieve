import { expect, it } from "vitest";
import { ADMIN_REPORT_TYPES, resolveAdminReportType } from "./adminReportTypes";
it("seleciona T&D por padrão e rejeita tipos desconhecidos", () => {
  expect(resolveAdminReportType(null)).toBe("td");
  expect(resolveAdminReportType("unknown")).toBe("td");
  expect(resolveAdminReportType("progress")).toBe("progress");
});
it("limita os filtros ao tipo aplicável", () => {
  expect(ADMIN_REPORT_TYPES.find(t => t.id === "td")?.filters).toEqual(["period", "area", "training"]);
  expect(ADMIN_REPORT_TYPES.find(t => t.id === "progress")?.filters).toEqual(["training"]);
});