/* RANEEV credential tests — validate that plaintext passwords never become persisted credential values. */
import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./auth/credentials";

describe("RANEEV credentials", () => {
  it("rejects weak passwords before hashing", () => {
    expect(validatePassword("short1A")).toContain("12 characters");
    expect(validatePassword("alllowercase123")).toContain("upper-case");
    expect(validatePassword("ValidPassword26")).toBeNull();
  });

  it("stores a versioned salted scrypt hash and never the plaintext", async () => {
    const password = "ValidPassword26";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt\$v1\$/);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword26", hash)).toBe(false);
  });
});
