import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { OPERATOR_COOKIE, OPERATOR_MAX_AGE, isOperator, operatorSessionToken, verifyOperatorPassword } from "@/lib/operator-auth";

describe("operator auth", () => {
  it("verifies the configured operator password (dev default 'operator')", () => {
    expect(verifyOperatorPassword("operator")).toBe(true);
    expect(verifyOperatorPassword("nope")).toBe(false);
    expect(verifyOperatorPassword("")).toBe(false);
  });

  it("produces a time-bound session token accepted by isOperator", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const t = operatorSessionToken(nowSec);
    // Format: "${issuedAt}.${64-char-hex}"
    expect(t.startsWith(`${nowSec}.`)).toBe(true);
    // Same inputs → same token.
    expect(operatorSessionToken(nowSec)).toBe(t);

    const req = (token: string) =>
      new NextRequest("http://localhost/api/operator/businesses", {
        headers: { cookie: `${OPERATOR_COOKIE}=${token}` },
      });

    expect(isOperator(req(t))).toBe(true);
    // Expired token must be rejected.
    const staleToken = operatorSessionToken(nowSec - OPERATOR_MAX_AGE - 1);
    expect(isOperator(req(staleToken))).toBe(false);
  });
});
