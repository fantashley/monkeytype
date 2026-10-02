import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createRoot } from "solid-js";
import { Configuration } from "@monkeytype/schemas/configuration";
import Ape from "../../src/ts/ape";
import * as ServerConfiguration from "../../src/ts/ape/server-configuration";
import * as CoreSignals from "../../src/ts/states/core";
import * as Notifications from "../../src/ts/states/notifications";
import {
  maxMailboxSize,
  refetchInboxCollection,
  useInboxQuery,
} from "../../src/ts/collections/inbox";

//mock modules to avoid dependencies
vi.mock("../../src/ts/ape", () => ({
  default: { users: { getInbox: vi.fn() } },
}));
vi.mock("../../src/ts/ape/server-configuration", () => ({
  configurationPromise: Promise.resolve(true),
  get: vi.fn(),
}));

describe("inbox collection", () => {
  const getInboxMock = vi.mocked(Ape.users.getInbox);
  const getServerConfigurationMock = vi.mocked(ServerConfiguration.get);
  const notifyErrorMock = vi.spyOn(Notifications, "showErrorNotification");

  function mockInboxEnabled(enabled: boolean): void {
    getServerConfigurationMock.mockReturnValue({
      users: { inbox: { enabled, maxMail: 10 } },
    } as Configuration);
  }

  beforeAll(() => {
    vi.spyOn(CoreSignals, "isAuthenticated").mockReturnValue(true);
    mockInboxEnabled(false);
    //subscribe to the collection so it syncs
    createRoot(() => useInboxQuery(() => true));
  });

  beforeEach(() => {
    getInboxMock.mockReset();
    notifyErrorMock.mockClear();
  });

  it("doesn't fetch the inbox when it's disabled", async () => {
    await refetchInboxCollection();

    expect(getServerConfigurationMock).toHaveBeenCalled();
    expect(getInboxMock).not.toHaveBeenCalled();
    expect(notifyErrorMock).not.toHaveBeenCalled();
    expect(maxMailboxSize()).toEqual(0);
  });

  it("fetches the inbox when it's enabled", async () => {
    mockInboxEnabled(true);
    getInboxMock.mockResolvedValue({
      status: 200,
      body: { message: "", data: { inbox: [], maxMail: 10 } },
    } as unknown as Awaited<ReturnType<typeof Ape.users.getInbox>>);

    await refetchInboxCollection();

    expect(getInboxMock).toHaveBeenCalledOnce();
    expect(maxMailboxSize()).toEqual(10);
  });
});
