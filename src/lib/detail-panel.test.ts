import { describe, expect, it } from "vitest";
import { canViewFinancePanel, getPersonDisplayName } from "./detail-panel";

describe("detail-panel helpers", () => {
  it("builds the display name from either full_name or first/middle/last parts", () => {
    expect(
      getPersonDisplayName({
        first_name: "Asha",
        middle_name: "M",
        last_name: "Mwangi",
      }),
    ).toBe("Asha M Mwangi");

    expect(
      getPersonDisplayName({
        full_name: "Daniel Otieno",
      }),
    ).toBe("Daniel Otieno");
  });

  it("restricts finance visibility to approved roles", () => {
    expect(canViewFinancePanel(["principal", "super_admin"])) .toBe(true);
    expect(canViewFinancePanel(["teacher", "class_teacher"])) .toBe(false);
    expect(canViewFinancePanel([])).toBe(false);
  });
});
