import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, it, expect, vi } from "vitest";

import {
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
  ): ReturnType<typeof vi.fn> {
    const [getSelection] = createSignal(current);
    const onSelect = vi.fn();
    render(() => (
      <Sidebar
        selection={getSelection}
        allTimeModes={allTimeModes}
        onSelect={onSelect}
        validModeRules={[{ language: "english", mode: "time", mode2: "15" }]}
        connectionsEnabled={false}
      />
    ));
    return onSelect;
  }

  it("switches to the first configured all-time leaderboard", () => {
    const onSelect = renderSidebar(selection(), ["60", "30"]);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(
      selection({ mode2: "30" }),
    );
  });

  it("keeps a configured all-time leaderboard", () => {
    const onSelect = renderSidebar(selection({ mode2: "60" }), ["30", "60"]);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps daily leaderboards", () => {
    const onSelect = renderSidebar(selection({ type: "daily" }), ["30"]);

    expect(onSelect).not.toHaveBeenCalled();
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
