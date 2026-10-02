import { describe, it, expect, beforeEach, vi } from "vitest";
import * as PageController from "../../src/ts/controllers/page-controller";
import * as Firebase from "../../src/ts/firebase";
import * as CoreSignals from "../../src/ts/states/core";
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

  it("shows pages when the server configuration can't be fetched", async () => {
    fetchQueryMock.mockRejectedValue(new Error("server down"));

    await navigate("/", { force: true });

    expect(changePageMock).toHaveBeenCalledWith("test", { force: true });
  });
});
