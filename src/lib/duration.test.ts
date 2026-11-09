import { describe, it, expect } from "vitest";
import { parseDurationHHMM, formatDuration, hoursToHHMM } from "./duration";

describe("duração HH:MM", () => {
  it("1:30 → 1h30min", () => { expect(parseDurationHHMM("1:30")).toBe(1.5); expect(formatDuration(1.5)).toBe("1h30min"); });
  it("2:15 → 2h15min", () => { expect(formatDuration(parseDurationHHMM("2:15"))).toBe("2h15min"); });
  it("0:45 → 45min", () => { expect(formatDuration(parseDurationHHMM("0:45"))).toBe("45min"); });
  it("10:30 → 10h30min", () => { expect(formatDuration(parseDurationHHMM("10:30"))).toBe("10h30min"); });
  it("130 sem dois pontos não vira 130 horas", () => { expect(parseDurationHHMM("130")).toBeNull(); });
  it("minutos acima de 59 são inválidos", () => { expect(parseDurationHHMM("1:75")).toBeNull(); });
  it("valor salvo volta para edição em HH:MM", () => { expect(hoursToHHMM(2)).toBe("2:00"); expect(hoursToHHMM(parseDurationHHMM("1:20"))).toBe("1:20"); });
});
