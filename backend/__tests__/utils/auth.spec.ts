import { describe, it, expect, afterEach, vi } from "vitest";
import * as AuthUtil from "../../src/utils/auth";
import { oidcAuthProvider } from "../../src/auth-providers/oidc";
import { firebaseAuthProvider } from "../../src/auth-providers/firebase";

describe("auth utils", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("with the firebase provider", () => {
    it("is the default provider", () => {
      expect(AuthUtil.isAuthUserManagedByBackend()).toBe(true);
    });

    it("deletes the auth user and revokes their tokens", async () => {
      const revokeMock = vi
        .spyOn(firebaseAuthProvider, "revokeTokens")
        .mockResolvedValue();
      const deleteMock = vi
        .spyOn(firebaseAuthProvider, "deleteUser")
        .mockResolvedValue();

      await AuthUtil.deleteUser("uid");

      expect(revokeMock).toHaveBeenCalledWith("uid");
      expect(deleteMock).toHaveBeenCalledWith("uid");
    });
  });

  describe("with the oidc provider", () => {
    const useOidc = (): void => {
      vi.stubEnv("AUTH_PROVIDER", "oidc");
    };

    it("does not manage auth users", () => {
      useOidc();
      expect(AuthUtil.isAuthUserManagedByBackend()).toBe(false);
    });

    it("ignores auth user deletion", async () => {
      useOidc();
      const revokeMock = vi
        .spyOn(oidcAuthProvider, "revokeTokens")
        .mockResolvedValue();

      await AuthUtil.deleteUser("uid");

      expect(revokeMock).not.toHaveBeenCalled();
    });

    it.each([
      ["updateUserEmail", async () => AuthUtil.updateUserEmail("uid", "a@b.c")],
      [
        "updateUserPassword",
        async () => AuthUtil.updateUserPassword("uid", "pw"),
      ],
      ["isEmailVerified", async () => AuthUtil.isEmailVerified("uid")],
      [
        "generateEmailVerificationLink",
        async () => AuthUtil.generateEmailVerificationLink("a@b.c"),
      ],
      [
        "sendForgotPasswordEmail",
        async () => AuthUtil.sendForgotPasswordEmail("a@b.c"),
      ],
    ])("rejects %s", async (_name, call) => {
      useOidc();

      await expect(call()).rejects.toMatchObject({
        status: 400,
        message:
          "This action is not supported by the configured authentication provider (oidc)",
      });
    });

    it("generates a random uid when creating a user", async () => {
      useOidc();

      const uid = await AuthUtil.createUser("a@b.c", "pw", "name");

      expect(uid).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("revokes tokens through the provider", async () => {
      useOidc();
      const revokeMock = vi
        .spyOn(oidcAuthProvider, "revokeTokens")
        .mockResolvedValue();

      await AuthUtil.revokeTokensByUid("uid");

      expect(revokeMock).toHaveBeenCalledWith("uid");
    });
  });

  it("rejects an unknown provider", () => {
    vi.stubEnv("AUTH_PROVIDER", "unknown");
    expect(() => AuthUtil.isAuthUserManagedByBackend()).toThrow(
      'Unknown AUTH_PROVIDER "unknown"',
    );
  });
});
