import { describe, expect, it } from "vitest";
import { operatorSessionToken, verifyOperatorPassword } from "@/lib/operator-auth";

describe("operator auth", () => {
  it("verifies the configured operator password (dev default 'operator')", () => {
    expect(verifyOperatorPassword("operator")).toBe(true);
    expect(verifyOperatorPassword("nope")).toBe(false);
    expect(verifyOperatorPassword("")).toBe(false);
  });

  it("produces a stable 64-char session token", () => {
    const t = operatorSessionToken();
    expect(t).toHaveLength(64); // sha256 hex
    expect(operatorSessionToken()).toBe(t);
  });
});
