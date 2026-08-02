import { describe, expect, it } from "vitest";
import { advanceSession, groupStandings } from "./progression";
const match = (overrides: Record<string, unknown> = {}) => ({
  id: "m",
  homeTeamId: "a",
  awayTeamId: "b",
  winnerTeamId: null,
  round: 1,
  sequence: 0,
  status: "PENDING",
  ...overrides,
});
const team = (id: string) => ({
  id,
  seed: Number(id.charCodeAt(0)),
  name: id,
  totalRating: 10,
});
function txFor(session: Record<string, unknown>) {
  const calls: Array<{ op: string; data?: unknown }> = [];
  return {
    calls,
    session: {
      findUniqueOrThrow: async () => session,
      update: async (input: { data: unknown }) =>
        calls.push({ op: "complete", data: input.data }),
    },
    match: {
      update: async (input: { data: unknown }) =>
        calls.push({ op: "update", data: input.data }),
      create: async (input: { data: unknown }) =>
        calls.push({ op: "create", data: input.data }),
      createMany: async (input: { data: unknown }) =>
        calls.push({ op: "many", data: input.data }),
    },
  } as unknown as Parameters<typeof advanceSession>[0] & {
    calls: typeof calls;
  };
}
describe("session progression", () => {
  it("activates exactly the first pending match", async () => {
    const tx = txFor({
      id: "s",
      format: "ROUND_ROBIN",
      matches: [match(), match({ id: "m2", sequence: 1 })],
      teams: [team("a"), team("b")],
    });
    await advanceSession(tx, "s");
    expect(tx.calls).toEqual([
      { op: "update", data: { status: "LIVE", startedAt: expect.any(Date) } },
    ]);
  });
  it("makes a winner-stays challenger court", async () => {
    const tx = txFor({
      id: "s",
      format: "WINNER_STAYS",
      matches: [match({ status: "CONFIRMED", winnerTeamId: "a" })],
      teams: [team("a"), team("b"), team("c")],
    });
    await advanceSession(tx, "s");
    expect(tx.calls[0]).toMatchObject({
      op: "create",
      data: { homeTeamId: "a", awayTeamId: "c", status: "LIVE" },
    });
  });
  it("keeps a loser rotating at the tail of a persisted winner-stays queue", async () => {
    const tx = txFor({
      id: "s",
      format: "WINNER_STAYS",
      progression: { queue: ["c", "d"] },
      matches: [match({ status: "CONFIRMED", winnerTeamId: "a" })],
      teams: [team("a"), team("b"), team("c"), team("d")],
    });
    await advanceSession(tx, "s");
    expect(tx.calls[1]).toMatchObject({
      op: "complete",
      data: { progression: { queue: ["d", "b"] } },
    });
  });
  it("creates a knockout final from round winners", async () => {
    const tx = txFor({
      id: "s",
      format: "KNOCKOUT",
      matches: [
        match({ id: "1", status: "CONFIRMED", winnerTeamId: "a", sequence: 0 }),
        match({
          id: "2",
          homeTeamId: "c",
          awayTeamId: "d",
          status: "CONFIRMED",
          winnerTeamId: "c",
          sequence: 1,
        }),
      ],
      teams: [team("a"), team("b"), team("c"), team("d")],
    });
    await advanceSession(tx, "s");
    expect(tx.calls[0]).toMatchObject({ op: "many" });
  });
  it("builds group semi-finals after group fixtures", async () => {
    const games = [
      match({
        id: "1",
        status: "CONFIRMED",
        winnerTeamId: "a",
        sequence: 0,
        group: "A",
      }),
      match({
        id: "2",
        homeTeamId: "b",
        awayTeamId: "c",
        status: "CONFIRMED",
        winnerTeamId: "b",
        sequence: 1,
        group: "A",
      }),
      match({
        id: "3",
        homeTeamId: "c",
        awayTeamId: "d",
        status: "CONFIRMED",
        winnerTeamId: "c",
        sequence: 2,
        group: "B",
      }),
      match({
        id: "4",
        homeTeamId: "d",
        awayTeamId: "a",
        status: "CONFIRMED",
        winnerTeamId: "d",
        sequence: 3,
        group: "B",
      }),
    ];
    const tx = txFor({
      id: "s",
      format: "GROUPS_KNOCKOUT",
      matches: games,
      teams: [team("a"), team("b"), team("c"), team("d")],
    });
    await advanceSession(tx, "s");
    expect(tx.calls[0]).toMatchObject({ op: "many" });
  });
  it("ranks a group by wins, game differential, games, then seed", () => {
    const seeds = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    expect(
      groupStandings(
        ["a", "b", "c"],
        [
          {
            homeTeamId: "a",
            awayTeamId: "b",
            winnerTeamId: "a",
            homeGames: 6,
            awayGames: 4,
          },
          {
            homeTeamId: "c",
            awayTeamId: "a",
            winnerTeamId: "c",
            homeGames: 6,
            awayGames: 2,
          },
        ],
        seeds,
      ).map((row) => row.id),
    ).toEqual(["c", "a", "b"]);
  });
});
