import { afterEach, describe, expect, it } from "vitest";
import {
  getAdminPassword,
  getOperatorPassword,
  getOperatorSecret,
  getServerSecret,
  hashStaffPassword,
  verifyStaffPassword,
} from "@/lib/secret";

const orig = {
  env: process.env.NODE_ENV,
  secret: process.env.ADMIN_SECRET,
  pw: process.env.ADMIN_PASSWORD,
  opSecret: process.env.OPERATOR_SECRET,
  opPw: process.env.OPERATOR_PASSWORD,
};

type EnvKey = "NODE_ENV" | "ADMIN_SECRET" | "ADMIN_PASSWORD" | "OPERATOR_SECRET" | "OPERATOR_PASSWORD";
function restore(key: EnvKey, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restore("NODE_ENV", orig.env);
  restore("ADMIN_SECRET", orig.secret);
  restore("ADMIN_PASSWORD", orig.pw);
  restore("OPERATOR_SECRET", orig.opSecret);
  restore("OPERATOR_PASSWORD", orig.opPw);
});

describe("server secret (fail-closed)", () => {
  it("uses a dev fallback outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_PASSWORD;
    expect(getServerSecret().length).toBeGreaterThanOrEqual(16);
    expect(getAdminPassword()).toBe("letmein");
  });

  it("refuses guessable defaults in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_PASSWORD;
    expect(() => getServerSecret()).toThrow();
    expect(getAdminPassword()).toBeNull();
  });

  it("uses configured values in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_SECRET = "a-very-long-random-secret-value";
    process.env.ADMIN_PASSWORD = "s3cret-pw";
    expect(getServerSecret()).toBe("a-very-long-random-secret-value");
    expect(getAdminPassword()).toBe("s3cret-pw");
  });
});

describe("operator secret (fail-closed)", () => {
  it("uses a dev fallback outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.OPERATOR_SECRET;
    delete process.env.OPERATOR_PASSWORD;
    expect(getOperatorSecret().length).toBeGreaterThanOrEqual(16);
    expect(getOperatorPassword()).toBe("operator");
  });

  it("refuses guessable defaults in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.OPERATOR_SECRET;
    delete process.env.OPERATOR_PASSWORD;
    expect(() => getOperatorSecret()).toThrow();
    expect(getOperatorPassword()).toBeNull();
  });
});

describe("staff password hashing (scrypt)", () => {
  it("round-trips a password and rejects the wrong one", () => {
    const stored = hashStaffPassword("clinic-pass");
    expect(stored.algo).toBe("scrypt");
    expect(stored.hash).toContain(":");
    expect(verifyStaffPassword("clinic-pass", stored)).toBe(true);
    expect(verifyStaffPassword("nope", stored)).toBe(false);
    expect(verifyStaffPassword("clinic-pass", null)).toBe(false);
  });

  it("uses a random salt so two hashes of the same password differ", () => {
    expect(hashStaffPassword("same").hash).not.toBe(hashStaffPassword("same").hash);
  });
});
