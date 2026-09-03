import { describe, expect, it } from "vitest";
import { isCancelledMutationError, throwIfCancelled } from "./mutation-utils";

describe("mutation-utils", () => {
  it("throws when an action is explicitly cancelled", () => {
    expect(() => throwIfCancelled(true, "Deletion cancelled.")).toThrow("Deletion cancelled.");
  });

  it("detects cancellation-style errors", () => {
    expect(isCancelledMutationError(new Error("Deletion cancelled."))).toBe(true);
    expect(isCancelledMutationError(new Error("Network failed"))).toBe(false);
  });
});
