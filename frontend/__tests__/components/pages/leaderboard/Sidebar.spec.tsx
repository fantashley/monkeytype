import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, it, expect, vi } from "vitest";

import {
  getTypeButtons,
  isValidAllTimeSelection,
  Sidebar,
} from "../../../../src/ts/components/pages/leaderboard/Sidebar";
import { Selection } from "../../../../src/ts/states/leaderboard-selection";

function selection(patch: Partial<Selection> = {}): Selection {
  return {
    type: "allTime",
    mode: "time",
    mode2: "15",
    language: "english",
    friendsOnly: false,
    previous: false,
    ...patch,
  } as Selection;
}

describe("Sidebar", () => {
  function renderSidebar(
    current: Selection,
    allTimeModes: string[],
    weeklyXpEnabled = true,
  ): { onSelect: ReturnType<typeof vi.fn>; container: HTMLElement } {
    const [getSelection] = createSignal(current);
    const onSelect = vi.fn();
    const { container } = render(() => (
      <Sidebar
        selection={getSelection}
        allTimeModes={allTimeModes}
        onSelect={onSelect}
        validModeRules={[{ language: "english", mode: "time", mode2: "15" }]}
        connectionsEnabled={false}
        weeklyXpEnabled={weeklyXpEnabled}
      />
    ));
    return { onSelect, container };
  }

  it("switches to the first configured all-time leaderboard", () => {
    const { onSelect } = renderSidebar(selection(), ["60", "30"]);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      selection({ mode2: "30" }),
    );
  });

  it("keeps a configured all-time leaderboard", () => {
    const { onSelect } = renderSidebar(selection({ mode2: "60" }), [
      "30",
      "60",
    ]);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps daily leaderboards", () => {
    const { onSelect } = renderSidebar(selection({ type: "daily" }), ["30"]);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("leaves the weekly xp leaderboard if disabled", () => {
    const { onSelect, container } = renderSidebar(
      { type: "weekly", friendsOnly: false, previous: false },
      ["15", "60"],
      false,
    );

    expect(container.textContent).not.toContain("weekly xp");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(selection());
  });

  it("keeps the weekly xp leaderboard if enabled", () => {
    const { onSelect, container } = renderSidebar(
      { type: "weekly", friendsOnly: false, previous: false },
      ["15", "60"],
    );

    expect(container.textContent).toContain("weekly xp");
    expect(onSelect).not.toHaveBeenCalled();
  });

  describe("getTypeButtons", () => {
    it("includes the weekly xp leaderboard if enabled", () => {
      expect(getTypeButtons(true).map((it) => it.id)).toEqual([
        "allTime",
        "weekly",
        "daily",
      ]);
    });

    it("leaves out the weekly xp leaderboard if disabled", () => {
      expect(getTypeButtons(false).map((it) => it.id)).toEqual([
        "allTime",
        "daily",
      ]);
    });
  });

  describe("isValidAllTimeSelection", () => {
    it.each([
      { name: "configured mode", patch: {}, expected: true },
      { name: "other mode", patch: { mode2: "60" }, expected: false },
      {
        name: "other language",
        patch: { language: "german" },
        expected: false,
      },
      { name: "daily", patch: { type: "daily" }, expected: false },
    ] as { name: string; patch: Partial<Selection>; expected: boolean }[])(
      "$name",
      ({ patch, expected }) => {
        expect(isValidAllTimeSelection(selection(patch), ["15", "30"])).toBe(
          expected,
        );
      },
    );
  });
});
