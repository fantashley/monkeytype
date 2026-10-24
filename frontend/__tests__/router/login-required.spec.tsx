import { afterEach, describe, expect, it } from "vitest";

import { getServerConfigurationQueryOptions } from "../../src/ts/queries/server-configuration";
import { setLastKnownLoginRequired } from "../../src/ts/states/login-required";
import {
  __testing,
  getNotificationHistory,
} from "../../src/ts/states/notifications";
import { cleanupApp, deferred, renderApp } from "../__harness__/app-shell";

const serverConfigurationKey = getServerConfigurationQueryOptions().queryKey;

function configuration(loginRequired: boolean): unknown {
  return { users: { loginRequired } };
}

describe("login required", () => {
  afterEach(() => cleanupApp());

  it("shows pages to signed out users by default", async () => {
    const app = renderApp({ url: "/leaderboards", auth: "signedOut" });
    await app.settle();

    expect(app.url()).toMatch(/^\/leaderboards/);
    expect(app.shownPage()).toBe("leaderboards");
  });

  describe("when required", () => {
    it.each(["/", "/leaderboards", "/settings", "/profile/bob"])(
      "redirects signed out users from %s to the login page",
      async (url) => {
        const app = renderApp({ url, auth: "signedOut", loginRequired: true });
        await app.settle();

        expect(app.url()).toBe("/login");
        expect(app.shownPage()).toBe("login");
      },
    );

    it("shows pages to signed in users", async () => {
      const app = renderApp({
        url: "/settings",
        auth: "signedIn",
        loginRequired: true,
      });
      await app.settle();

      expect(app.shownPage()).toBe("settings");
    });

    it("sends users to the login page when they sign out", async () => {
      const app = renderApp({
        url: "/settings",
        auth: "signedIn",
        loginRequired: true,
      });
      await app.settle();

      app.auth.signOut();
      await app.settle();

      expect(app.url()).toBe("/login");
      expect(app.shownPage()).toBe("login");
    });

    it("shows the login page when authentication is unavailable", async () => {
      const app = renderApp({
        url: "/",
        auth: "signedOut",
        authAvailable: false,
        loginRequired: true,
      });
      await app.settle();

      expect(app.url()).toBe("/login");
      expect(app.shownPage()).toBe("login");
    });

    it("doesn't wait for the server configuration", async () => {
      const app = renderApp({
        url: "/",
        auth: "signedOut",
        loginRequired: true,
        queryResponses: [
          [serverConfigurationKey, async () => deferred<unknown>().promise],
        ],
      });
      await app.settle();

      expect(app.shownPage()).toBe("login");
    });
  });

  describe("when the server configuration changed since the last visit", () => {
    it("sends signed out users to the login page once it's loaded", async () => {
      const serverConfiguration = deferred<unknown>();
      const app = renderApp({
        url: "/",
        auth: "signedOut",
        loginRequired: false,
        queryResponses: [
          [serverConfigurationKey, async () => serverConfiguration.promise],
        ],
      });
      await app.settle();
      expect(app.shownPage()).toBe("test");

      void app.queryClient.prefetchQuery(getServerConfigurationQueryOptions());
      serverConfiguration.resolve(configuration(true));
      await app.settle();

      expect(app.url()).toBe("/login");
      expect(app.shownPage()).toBe("login");
    });

    it("keeps signed in users on their page", async () => {
      const app = renderApp({
        url: "/settings",
        auth: "signedIn",
        loginRequired: false,
        queryResponses: [
          [serverConfigurationKey, async () => configuration(true)],
        ],
      });
      await app.settle();

      await app.queryClient.fetchQuery(getServerConfigurationQueryOptions());
      await app.settle();

      expect(app.shownPage()).toBe("settings");
    });
  });

  describe("when this browser never loaded the server configuration", () => {
    it.each([
      { loginRequired: false, page: "test" },
      { loginRequired: true, page: "login" },
    ])(
      "waits for it (login required: $loginRequired)",
      async ({ loginRequired, page }) => {
        const app = renderApp({
          url: "/",
          auth: "signedOut",
          loginRequired: null,
          queryResponses: [
            [serverConfigurationKey, async () => configuration(loginRequired)],
          ],
        });
        await app.settle();

        expect(app.shownPage()).toBe(page);
      },
    );

    it("sends signed out users to the login page if it can't be loaded", async () => {
      const app = renderApp({
        url: "/",
        auth: "signedOut",
        loginRequired: null,
        queryResponses: [
          [
            serverConfigurationKey,
            async () => Promise.reject(new Error("server down")),
          ],
        ],
      });
      await app.settle();

      expect(app.url()).toBe("/login");
      expect(app.shownPage()).toBe("login");
    });

    it("shows pages to signed in users if it can't be loaded", async () => {
      const app = renderApp({
        url: "/settings",
        auth: "signedIn",
        loginRequired: null,
        queryResponses: [
          [
            serverConfigurationKey,
            async () => Promise.reject(new Error("server down")),
          ],
        ],
      });
      await app.settle();

      expect(app.shownPage()).toBe("settings");
    });

    it("doesn't wait for a failed request again", async () => {
      let isFirstRequest = true;
      const app = renderApp({
        url: "/",
        auth: "signedOut",
        loginRequired: null,
        queryResponses: [
          [
            serverConfigurationKey,
            // later requests never arrive
            async () => {
              if (!isFirstRequest) return deferred<unknown>().promise;
              isFirstRequest = false;
              throw new Error("server down");
            },
          ],
        ],
      });
      await app.settle();

      void app.navigate({ to: "/settings" });
      await app.settle();

      expect(app.url()).toBe("/login");
      expect(app.shownPage()).toBe("login");
    });
  });

  describe("with the no quit funbox", () => {
    it("lets signed out users leave the test once login is required", async () => {
      __testing.clearNotificationHistory();
      const app = renderApp({ url: "/", auth: "signedOut" });
      await app.settle();
      app.test.enableNoQuit();
      app.test.start();

      setLastKnownLoginRequired(true);
      await app.navigate({ to: "/about" });
      await app.settle();

      expect(app.url()).toBe("/login");
      expect(getNotificationHistory()).toEqual([]);
    });

    it("keeps signed in users in the test", async () => {
      __testing.clearNotificationHistory();
      const app = renderApp({
        url: "/",
        auth: "signedIn",
        loginRequired: true,
      });
      await app.settle();
      app.test.enableNoQuit();
      app.test.start();

      // a blocked navigation never resolves
      void app.navigate({ to: "/about" });
      await app.settle();

      expect(app.url()).toBe("/");
      expect(getNotificationHistory().map((n) => n.message)).toEqual([
        "No quit funbox is active. Please finish the test.",
      ]);
    });
  });
});
