import { describe, it, expect } from "vitest";
import {
  roundRobin,
  knockout,
  groups,
  winnerStaysNext,
  roundRobinStandings,
} from "./formats";
const teams = [1, 2, 3, 4].map((seed) => ({ id: String(seed), seed }));
describe("formats", () => {
  it("schedules every round robin pairing", () =>
    expect(roundRobin(teams)).toHaveLength(6));
  it("makes deterministic knockout fixtures", () =>
    expect(knockout(teams)[0]).toMatchObject({ homeId: "1", awayId: "4" }));
  it("creates only play-in matches when three or five teams need byes", () => {
    expect(knockout(teams.slice(0, 3))).toEqual([
      { homeId: "2", awayId: "3", round: 1, sequence: 0 },
    ]);
    expect(knockout([...teams, { id: "5", seed: 5 }])).toEqual([
      { homeId: "4", awayId: "5", round: 1, sequence: 0 },
    ]);
  });
  it("snake-seeds groups", () => {
    const x = groups(teams);
    expect(x.a.length + x.b.length).toBe(4);
  });
  it("rejects too-small groups", () =>
    expect(() => groups(teams.slice(0, 3))).toThrow());
  it("moves loser to queue tail", () =>
    expect(winnerStaysNext(["a", "b", "c"], "a", "b")).toEqual(["c", "b"]));
  it("orders tied teams by head-to-head before seed", () =>
    expect(
      roundRobinStandings(
        [
          { id: "a", name: "A", seed: 1 },
          { id: "b", name: "B", seed: 2 },
        ],
        [
          {
            homeTeamId: "a",
            awayTeamId: "b",
            winnerTeamId: "b",
            homeGames: 3,
            awayGames: 3,
            status: "CONFIRMED",
          },
        ],
      ).map((row) => row.id),
    ).toEqual(["b", "a"]));
});
