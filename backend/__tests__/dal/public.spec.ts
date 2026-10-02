import { describe, it, expect, vi, afterEach } from "vitest";
import * as db from "../../src/init/db";
import * as PublicDAL from "../../src/dal/public";

describe("PublicDAL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockStats(stats: unknown): void {
    vi.spyOn(db, "collection").mockReturnValue({
      findOne: vi.fn().mockResolvedValue(stats),
    } as unknown as ReturnType<typeof db.collection>);
  }

  describe("getTypingStats", () => {
    it("returns the stored stats", async () => {
      const stats = { testsCompleted: 3, testsStarted: 5, timeTyping: 90 };
      mockStats(stats);

      await expect(PublicDAL.getTypingStats()).resolves.toEqual(stats);
    });

    it("returns zero stats before the first result is saved", async () => {
      mockStats(null);

      await expect(PublicDAL.getTypingStats()).resolves.toEqual({
        testsCompleted: 0,
        testsStarted: 0,
        timeTyping: 0,
      });
    });
  });
});
