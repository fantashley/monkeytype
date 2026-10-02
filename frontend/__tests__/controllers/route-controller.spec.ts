import { describe, it, expect, beforeEach, vi } from "vitest";
import * as PageController from "../../src/ts/controllers/page-controller";
import * as Firebase from "../../src/ts/firebase";
import * as CoreSignals from "../../src/ts/states/core";
import * as TestState from "../../src/ts/states/test";
import * as Funbox from "../../src/ts/test/funbox/list";
import * as Notifications from "../../src/ts/states/notifications";
import { queryClient } from "../../src/ts/queries";
import { navigate } from "../../src/ts/controllers/route-controller";

//mock modules to avoid dependencies
vi.mock("../../src/ts/controllers/page-controller", () => ({
  change: vi.fn(),
}));
vi.mock("../../src/ts/firebase", () => ({
  authPromise: Promise.resolve(),
  isAuthAvailable: vi.fn(),
}));

describe("route-controller", () => {
  const changePageMock = vi.mocked(PageController.change);
  const isAuthAvailableMock = vi.mocked(Firebase.isAuthAvailable);
  const isAuthenticatedMock = vi.spyOn(CoreSignals, "isAuthenticated");
  const fetchQueryMock = vi.spyOn(queryClient, "fetchQuery");
  const isTestActiveMock = vi.spyOn(TestState, "isTestActive");
  const isFunboxActiveMock = vi.spyOn(Funbox, "isFunboxActive");
  const notifyMock = vi.spyOn(Notifications, "showNoticeNotification");

  function mockLoginRequired(loginRequired: boolean): void {
    fetchQueryMock.mockResolvedValue({
      users: { loginRequired },
    });
  }

  beforeEach(() => {
    history.replaceState(null, "", "/");
    changePageMock.mockClear();
    isAuthAvailableMock.mockReset().mockReturnValue(true);
    isAuthenticatedMock.mockClear().mockReturnValue(false);
    fetchQueryMock.mockReset();
    mockLoginRequired(false);
    isTestActiveMock.mockReset().mockReturnValue(false);
    isFunboxActiveMock.mockReset().mockReturnValue(false);
    notifyMock.mockClear();
  });

  it("shows pages to signed out users by default", async () => {
    await navigate("/leaderboards", { force: true });

    expect(changePageMock).toHaveBeenCalledOnce();
    expect(changePageMock).toHaveBeenCalledWith("leaderboards", {
      force: true,
    });
  });

  describe("with login required", () => {
    beforeEach(() => {
      mockLoginRequired(true);
    });

    it.each(["/", "/leaderboards", "/settings", "/profile/bob", "/unknown"])(
      "redirects signed out users from %s to the login page",
      async (url) => {
        await navigate(url, { force: true });

        expect(location.pathname).toEqual("/login");
        expect(changePageMock).toHaveBeenCalledOnce();
        expect(changePageMock).toHaveBeenCalledWith("login", { force: true });
      },
    );

    it("shows pages to signed in users", async () => {
      isAuthenticatedMock.mockReturnValue(true);

      await navigate("/", { force: true });

      expect(changePageMock).toHaveBeenCalledWith("test", { force: true });
    });

    it("shows the login page when authentication is unavailable", async () => {
      isAuthAvailableMock.mockReturnValue(false);

      await navigate("/", { force: true });

      expect(location.pathname).toEqual("/login");
      expect(changePageMock).toHaveBeenCalledWith("login", { force: true });
    });
  });

  describe("when the server configuration can't be fetched", () => {
    async function loadConfigurationThenFail(
      loginRequired: boolean,
    ): Promise<void> {
      mockLoginRequired(loginRequired);
      await navigate("/settings", { force: true });
      changePageMock.mockClear();
      fetchQueryMock.mockRejectedValue(new Error("server down"));
    }

    it("keeps login required if it was required before", async () => {
      await loadConfigurationThenFail(true);

      await navigate("/", { force: true });

      expect(location.pathname).toEqual("/login");
      expect(changePageMock).toHaveBeenCalledWith("login", { force: true });
    });

    it("shows pages if login wasn't required before", async () => {
      await loadConfigurationThenFail(false);

      await navigate("/", { force: true });

      expect(changePageMock).toHaveBeenCalledWith("test", { force: true });
    });
  });

  describe("with the no quit funbox", () => {
    beforeEach(() => {
      isTestActiveMock.mockReturnValue(true);
      isFunboxActiveMock.mockImplementation((name) => name === "no_quit");
    });

    it("sends signed out users to the login page when login is required", async () => {
      mockLoginRequired(true);

      await navigate("/", { force: true });

      expect(location.pathname).toEqual("/login");
      expect(changePageMock).toHaveBeenCalledWith("login", { force: true });
      expect(notifyMock).not.toHaveBeenCalled();
    });

    it("keeps signed in users in the test", async () => {
      mockLoginRequired(true);
      isAuthenticatedMock.mockReturnValue(true);

      await navigate("/leaderboards", { force: true });

      expect(location.pathname).toEqual("/");
      expect(changePageMock).not.toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledOnce();
    });

    it("keeps signed out users in the test when login isn't required", async () => {
      await navigate("/leaderboards", { force: true });

      expect(location.pathname).toEqual("/");
      expect(changePageMock).not.toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledOnce();
    });
  });
});
