import { describe, expect, it } from "vitest";
import { formatMatchShare, formatSessionShare, whatsappUrl } from "./share";
describe("sharing", () => {
  it("formats a completed match", () =>
    expect(
      formatMatchShare({
        session: "Friday",
        home: "A",
        away: "B",
        score: "3–1",
        winner: "A",
      }),
    ).toContain("Winner: A"));
  it("formats completed session fixtures", () =>
    expect(
      formatSessionShare({
        session: "Friday",
        format: "ROUND ROBIN",
        fixtures: [{ home: "A", away: "B", score: "3–1", winner: "A" }],
      }),
    ).toContain("A vs B — 3–1 (A)"));
  it("encodes WhatsApp content", () =>
    expect(whatsappUrl("A & B")).toContain("A%20%26%20B"));
});
