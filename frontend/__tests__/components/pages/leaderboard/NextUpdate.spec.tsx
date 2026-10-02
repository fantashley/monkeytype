import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";

import { NextUpdate } from "../../../../src/ts/components/pages/leaderboard/NextUpdate";

describe("NextUpdate", () => {
  it("shows when the all-time leaderboard updates next", () => {
    const { container } = render(() => (
      <NextUpdate type="allTime" updateOnResult={false} />
    ));

    expect(container.textContent).toMatch(/^Next update in: /);
  });

  it("shows that the all-time leaderboard updates after every test", () => {
    const { container } = render(() => (
      <NextUpdate type="allTime" updateOnResult={true} />
    ));

    expect(container.textContent).toEqual("Updates after every test");
  });

  it("shows when the daily leaderboard resets", () => {
    const { container } = render(() => (
      <NextUpdate type="daily" updateOnResult={true} />
    ));

    expect(container.textContent).toMatch(/^Next reset in: /);
  });
});
