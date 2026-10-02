import { describe, it, expect, beforeEach, vi } from "vitest";
import * as LeaderboardsDAL from "../../src/dal/leaderboards";
import { updateLeaderboard } from "../../src/jobs/update-leaderboards";

describe("update-leaderboards", () => {
  const getMock = vi.spyOn(LeaderboardsDAL, "get");
  const updateMock = vi.spyOn(LeaderboardsDAL, "update");

  beforeEach(() => {
    getMock.mockReset().mockResolvedValue([]);
    updateMock.mockReset().mockResolvedValue({ message: "" });
  });

  describe("updateLeaderboard", () => {
    it("updates the leaderboard", async () => {
      await updateLeaderboard("30");

      expect(updateMock).toHaveBeenCalledExactlyOnceWith(
        "time",
        "30",
        "english",
      );
    });

    it("combines updates requested during an update into one", async () => {
      let finishFirstUpdate = (): void => undefined;
      updateMock.mockImplementationOnce(
        async () =>
          new Promise((resolve) => {
            finishFirstUpdate = () => resolve({ message: "" });
          }),
      );

      const first = updateLeaderboard("15");
      await vi.waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
      const second = updateLeaderboard("15");
      const third = updateLeaderboard("15");
      expect(updateMock).toHaveBeenCalledOnce();

      finishFirstUpdate();
      await Promise.all([first, second, third]);

      expect(updateMock).toHaveBeenCalledTimes(2);
    });

    it("keeps updating after a failed update", async () => {
      let failFirstUpdate = (): void => undefined;
      updateMock.mockImplementationOnce(
        async () =>
          new Promise((_resolve, reject) => {
            failFirstUpdate = () => reject(new Error("update failed"));
          }),
      );

      const first = updateLeaderboard("60");
      await vi.waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
      const second = updateLeaderboard("60");

      failFirstUpdate();
      await expect(first).rejects.toThrow("update failed");
      await second;
      expect(updateMock).toHaveBeenCalledTimes(2);
    });

    it("updates different leaderboards independently", async () => {
      await Promise.all([updateLeaderboard("15"), updateLeaderboard("60")]);

      expect(updateMock).toHaveBeenCalledWith("time", "15", "english");
      expect(updateMock).toHaveBeenCalledWith("time", "60", "english");
    });
  });
});
