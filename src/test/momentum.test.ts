import { describe, expect, it } from "vitest";
import { projectValue } from "@/lib/momentum";
describe("projectValue", () => {
  it("compounds 100 lei/lună timp de 1 an la 6%", () => expect(projectValue(100, 1)).toBe(1234));
  it("returnează 0 pentru zero ani", () => expect(projectValue(200, 0)).toBe(0));
});
