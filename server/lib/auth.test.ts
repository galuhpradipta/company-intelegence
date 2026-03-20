import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signJwt, verifyJwt } from "./auth.ts";

const TEST_SECRET = "test-secret-for-unit-tests";

describe("hashPassword", () => {
  it("returns iterations$salt$hash format", async () => {
    const hash = await hashPassword("mypassword");
    const parts = hash.split("$");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("100000");
    expect(parts[1]).toHaveLength(32); // 16 bytes hex
    expect(parts[2]).toHaveLength(64); // 32 bytes hex
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("correct-password");
    expect(await verifyPassword(hash, "correct-password")).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct-password");
    expect(await verifyPassword(hash, "wrong-password")).toBe(false);
  });

  it("returns false for malformed stored hash", async () => {
    expect(await verifyPassword("not-valid-hash", "password")).toBe(false);
  });
});

describe("signJwt", () => {
  it("returns a valid JWT string (header.payload.signature)", async () => {
    const token = await signJwt({ sub: "user-1", email: "a@b.com" }, TEST_SECRET);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("verifyJwt", () => {
  it("decodes a valid token", async () => {
    const token = await signJwt({ sub: "user-1", email: "a@b.com" }, TEST_SECRET);
    const payload = await verifyJwt(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-1");
    expect(payload?.email).toBe("a@b.com");
  });

  it("returns null for an invalid token string", async () => {
    expect(await verifyJwt("invalid.token.here", TEST_SECRET)).toBeNull();
  });

  it("returns null when verified with the wrong secret", async () => {
    const token = await signJwt({ sub: "user-1", email: "a@b.com" }, TEST_SECRET);
    expect(await verifyJwt(token, "wrong-secret")).toBeNull();
  });

  it("round-trip: hash → verify → sign → verify", async () => {
    const hash = await hashPassword("round-trip-pass");
    expect(await verifyPassword(hash, "round-trip-pass")).toBe(true);

    const token = await signJwt({ sub: "rt-user", email: "rt@test.com" }, TEST_SECRET);
    const payload = await verifyJwt(token, TEST_SECRET);
    expect(payload?.sub).toBe("rt-user");
    expect(payload?.email).toBe("rt@test.com");
  });
});
