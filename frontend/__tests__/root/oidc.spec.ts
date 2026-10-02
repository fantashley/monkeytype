import { describe, it, expect, beforeEach, vi } from "vitest";
import type { User } from "oidc-client-ts";

import * as Oidc from "../../src/ts/oidc";
import { getUserId, isUserVerified } from "../../src/ts/states/core";

vi.mock("virtual:env-config", () => ({
  envConfig: {
    authProvider: "oidc",
    oidc: {
      authority: "https://id.example.com",
      clientId: "client",
      scope: "openid profile email",
      displayName: "Example ID",
      accountUrl: "",
    },
  },
}));

const manager = vi.hoisted(() => ({
  getUser: vi.fn(),
  removeUser: vi.fn(),
  storeUser: vi.fn(),
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  signinSilent: vi.fn(),
  signinPopup: vi.fn(),
  events: { addUserSignedOut: vi.fn() },
}));

vi.mock("../../src/ts/oidc-user-manager", () => ({
  createUserManager: async () => manager,
}));

function createUser(sub: string, expiresInSeconds = 3600): User {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    id_token: `token-${sub}-${exp}`,
    expired: expiresInSeconds <= 0,
    profile: { sub, exp },
  } as unknown as User;
}

describe("oidc", () => {
  const callback = vi.fn();

  beforeEach(async () => {
    vi.resetAllMocks();
    callback.mockResolvedValue(undefined);
    manager.getUser.mockResolvedValue(createUser("uid1"));
    window.history.replaceState(null, "", "/");
    await Oidc.init(callback);
    callback.mockClear();
  });

  describe("init", () => {
    it("restores a stored user", () => {
      expect(Oidc.isAuthAvailable()).toBe(true);
      expect(getUserId()).toEqual("uid1");
      expect(isUserVerified()).toBe(true);
    });

    it("reports no user when signed out", async () => {
      manager.getUser.mockResolvedValue(null);

      await Oidc.init(callback);

      expect(callback).toHaveBeenCalledWith(true, null);
      expect(getUserId()).toBeNull();
    });

    it("completes the redirect sign in", async () => {
      window.history.replaceState(null, "", "/login?code=abc&state=xyz");

      await Oidc.init(callback);

      expect(manager.signinRedirectCallback).toHaveBeenCalled();
      expect(window.location.pathname + window.location.search).toEqual(
        "/login",
      );
      expect(callback).toHaveBeenCalledWith(true, { uid: "uid1" });
    });

    it("drops an expired user that can't be renewed", async () => {
      manager.getUser.mockResolvedValue(createUser("uid1", -10));
      manager.signinSilent.mockRejectedValue(new Error("login required"));

      await Oidc.init(callback);

      expect(manager.removeUser).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(true, null);
    });
  });

  describe("getIdToken", () => {
    it("returns the id token", async () => {
      const user = createUser("uid1");
      manager.getUser.mockResolvedValue(user);

      await expect(Oidc.getIdToken()).resolves.toEqual(user.id_token);
      expect(manager.signinSilent).not.toHaveBeenCalled();
    });

    it("renews a token that is about to expire, once for concurrent calls", async () => {
      const renewed = createUser("uid1");
      manager.getUser.mockResolvedValue(createUser("uid1", 10));
      manager.signinSilent.mockResolvedValue(renewed);

      const tokens = await Promise.all([Oidc.getIdToken(), Oidc.getIdToken()]);

      expect(tokens).toEqual([renewed.id_token, renewed.id_token]);
      expect(manager.signinSilent).toHaveBeenCalledOnce();
    });

    it("signs out if the token can't be renewed", async () => {
      manager.getUser.mockResolvedValue(createUser("uid1", 10));
      manager.signinSilent.mockRejectedValue(new Error("login required"));

      await expect(Oidc.getIdToken()).resolves.toBeNull();
      expect(manager.removeUser).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(true, null);
      expect(getUserId()).toBeNull();
    });
  });

  describe("account changes in other tabs", () => {
    const reloadMock = vi.fn();

    beforeEach(() => {
      reloadMock.mockReset();
      vi.spyOn(window.location, "reload").mockImplementation(reloadMock);
    });

    it("does not use the token of another account", async () => {
      manager.getUser.mockResolvedValue(createUser("uid2"));

      await expect(Oidc.getIdToken()).resolves.toBeNull();
      expect(reloadMock).toHaveBeenCalled();
    });

    it("does not use a token renewed for another account", async () => {
      manager.getUser.mockResolvedValue(createUser("uid1", 10));
      manager.signinSilent.mockResolvedValue(createUser("uid2"));

      await expect(Oidc.getIdToken()).resolves.toBeNull();
      expect(manager.signinSilent).toHaveBeenCalled();
      expect(reloadMock).toHaveBeenCalled();
    });

    it("reloads when another tab signs in with a different account", async () => {
      manager.getUser.mockResolvedValue(createUser("uid2"));

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "oidc.user:https://id.example.com:client",
        }),
      );

      await vi.waitFor(() => expect(reloadMock).toHaveBeenCalled());
    });

    it("reloads when another tab signs out", async () => {
      manager.getUser.mockResolvedValue(null);

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "oidc.user:https://id.example.com:client",
        }),
      );

      await vi.waitFor(() => expect(reloadMock).toHaveBeenCalled());
    });

    it("ignores token renewals of the same account", async () => {
      manager.getUser.mockResolvedValue(createUser("uid1"));

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "oidc.user:https://id.example.com:client",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(reloadMock).not.toHaveBeenCalled();
    });
  });

  describe("reauthenticate", () => {
    it("forces a new sign in", async () => {
      manager.signinPopup.mockResolvedValue(createUser("uid1"));

      await Oidc.reauthenticate();

      expect(manager.signinPopup).toHaveBeenCalledWith({
        prompt: "login",
        max_age: 0,
      });
    });

    it("rejects a different account and keeps the current one", async () => {
      const current = createUser("uid1");
      manager.getUser.mockResolvedValue(current);
      manager.signinPopup.mockResolvedValue(createUser("uid2"));

      await expect(Oidc.reauthenticate()).rejects.toThrow(
        "Signed in with a different account",
      );
      expect(manager.storeUser).toHaveBeenCalledWith(current);
    });
  });

  it("asks the user to authenticate when signing in", async () => {
    await Oidc.signIn();

    expect(manager.signinRedirect).toHaveBeenCalledWith({ prompt: "login" });
  });

  it("signs out locally", async () => {
    await Oidc.signOut();

    expect(manager.removeUser).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(true, null);
    expect(getUserId()).toBeNull();
  });
});
