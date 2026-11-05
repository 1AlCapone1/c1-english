import { describe, it, expect } from "vitest";
import { classifyAuthError, isTokenHash, parseAuthLink } from "./authRedirect";

describe("parseAuthLink", () => {
  it("reads token_hash from the query (custom e-mail template)", () => {
    const l = parseAuthLink("?token_hash=abc123abc123abc123abc123abc123abc123abc123abc123abc123ab&type=email", "");
    expect(l?.tokenHash).toBe("abc123abc123abc123abc123abc123abc123abc123abc123abc123ab");
    expect(l?.type).toBe("email");
  });
  it("reads a PKCE code from the query", () => { expect(parseAuthLink("?code=xyz", "")?.code).toBe("xyz"); });
  it("reads an error from a bare fragment (otherwise HashRouter treats it as a route)", () => {
    const l = parseAuthLink("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(l?.errorCode).toBe("otp_expired");
    expect(l?.errorDescription).toBe("Email link is invalid or has expired");
  });
  it("reads parameters placed after a hash route", () => {
    expect(parseAuthLink("", "#/auth/confirm?token_hash=ff&type=recovery")?.type).toBe("recovery");
    expect(parseAuthLink("", "#/login#error=server_error")?.error).toBe("server_error");
  });
  it("ignores ordinary app URLs", () => {
    expect(parseAuthLink("", "#/dashboard")).toBe(null);
    expect(parseAuthLink("?utm=x", "#/grammar/cleft-sentences")).toBe(null);
  });
});

describe("classifyAuthError", () => {
  it("expired or used links", () => { expect(classifyAuthError("otp_expired", "Email link is invalid or has expired")).toBe("expired"); });
  it("missing PKCE verifier = opened on another device", () => {
    expect(classifyAuthError("bad_code_verifier", "invalid request: both auth code and code verifier should be non-empty")).toBe("other_device");
    expect(classifyAuthError(undefined, "AuthPKCECodeVerifierMissingError: PKCE code verifier not found in storage")).toBe("other_device");
  });
  it("network and server problems", () => {
    expect(classifyAuthError(null, "Failed to fetch")).toBe("network");
    expect(classifyAuthError("unexpected_failure", "boom", 500)).toBe("server");
  });
  it("already confirmed", () => { expect(classifyAuthError("email_already_confirmed", "")).toBe("already"); });
  it("anything else is an invalid link", () => { expect(classifyAuthError("validation_failed", "bad token")).toBe("invalid"); });
});

describe("isTokenHash", () => {
  it("accepts hex hashes with optional pkce_ prefix", () => {
    expect(isTokenHash("a".repeat(56))).toBe(true);
    expect(isTokenHash("pkce_" + "0f".repeat(28))).toBe(true);
    expect(isTokenHash("not-a-token")).toBe(false);
    expect(isTokenHash(null)).toBe(false);
  });
});
