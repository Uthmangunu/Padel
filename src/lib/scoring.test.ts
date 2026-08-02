import { describe, it, expect } from "vitest";
import {
  initialScore,
  reduceScore,
  scoreFromEvents,
  displayPoints,
} from "./scoring";
describe("padel scoring", () => {
  it("handles a repeated deuce loop then an advantage game", () => {
    let s = initialScore();
    for (const winner of [0, 1, 0, 1, 0, 1, 0, 1, 0, 0] as const)
      s = reduceScore(s, { type: "POINT", winner }, "RACE_TO_3", "ADVANTAGE");
    expect(s.games).toEqual([1, 0]);
    expect(s.points).toEqual([0, 0]);
  });
  it("ends a golden point at deuce", () => {
    let s = initialScore();
    for (const winner of [0, 0, 0, 1, 1, 1, 1] as const)
      s = reduceScore(
        s,
        { type: "POINT", winner },
        "RACE_TO_3",
        "GOLDEN_POINT",
      );
    expect(s.games).toEqual([0, 1]);
    expect(s.clutch.wins).toEqual([0, 1]);
  });
  it("wins race-to-three and ignores later scores", () => {
    const events = [0, 0, 0, 1].map((winner) => ({
      type: "TEAM_GAME" as const,
      winner: winner as 0 | 1,
    }));
    const s = scoreFromEvents(events, "RACE_TO_3", "ADVANTAGE");
    expect(s.winner).toBe(0);
    expect(s.games).toEqual([3, 0]);
  });
  it("supports a standard tiebreak", () => {
    let s = initialScore();
    for (let i = 0; i < 12; i++)
      s = reduceScore(
        s,
        { type: "TEAM_GAME", winner: (i % 2) as 0 | 1 },
        "BEST_OF_3_STANDARD",
        "ADVANTAGE",
      );
    for (let i = 0; i < 7; i++)
      s = reduceScore(
        s,
        { type: "TIEBREAK_GAME", winner: 0 },
        "BEST_OF_3_STANDARD",
        "ADVANTAGE",
      );
    expect(s.sets).toEqual([1, 0]);
  });
  it("labels an advantage", () => {
    const s = { ...initialScore(), points: [4, 3] as [number, number] };
    expect(displayPoints(s, "ADVANTAGE")).toEqual(["AD", "40"]);
  });
});
describe("event-sourced scoring", () => {
  it("replays append-only undo events", () => {
    const s = scoreFromEvents(
      [
        { type: "TEAM_GAME", winner: 0 },
        { type: "TEAM_GAME", winner: 1 },
        { type: "UNDO" },
      ],
      "RACE_TO_3",
      "ADVANTAGE",
    );
    expect(s.games).toEqual([1, 0]);
  });
  it("stores a single completed tiebreak set", () => {
    const s = scoreFromEvents(
      [
        ...Array.from({ length: 12 }, (_, i) => ({
          type: "TEAM_GAME" as const,
          winner: (i % 2) as 0 | 1,
        })),
        ...Array.from({ length: 7 }, () => ({
          type: "TIEBREAK_GAME" as const,
          winner: 1 as 0 | 1,
        })),
      ],
      "BEST_OF_3_STANDARD",
      "ADVANTAGE",
    );
    expect(s.setScores).toEqual([{ games: [6, 7], tiebreak: [0, 7] }]);
    expect(s.totalGames).toEqual([6, 7]);
  });
});
