import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as createList } from "@/app/api/lists/route";
import { POST as createPlayer } from "@/app/api/lists/[listId]/players/route";
import { DELETE as archivePlayer } from "@/app/api/players/[playerId]/route";
import { POST as createSession } from "@/app/api/sessions/route";
import { POST as scoreMatch } from "@/app/api/matches/[matchId]/score/route";

const enabled = Boolean(process.env.DATABASE_URL?.includes("postgres"));
const suffix = `integration-${Date.now()}`;
const ids: { list?: string; players: string[] } = { players: [] };
const params = (value: string) => ({
  params: Promise.resolve({ listId: value }),
});
describe.skipIf(!enabled)("route persistence", () => {
  it("creates a list, soft-deletes a player, creates a session, and rejects a stale score revision", async () => {
    const listResponse = await createList(
      new Request("http://test/api/lists", {
        method: "POST",
        body: JSON.stringify({ name: suffix }),
      }),
    );
    expect(listResponse.status).toBe(201);
    const list = (await listResponse.json()) as { id: string };
    ids.list = list.id;
    for (const [index, name] of ["A", "B", "C", "D", "E"].entries()) {
      const response = await createPlayer(
        new Request("http://test", {
          method: "POST",
          body: JSON.stringify({
            name: `${suffix}-${name}`,
            rating: 6 + index / 10,
          }),
        }),
        params(list.id),
      );
      expect(response.status).toBe(201);
      ids.players.push(((await response.json()) as { id: string }).id);
    }
    expect(
      (
        await archivePlayer(new Request("http://test", { method: "DELETE" }), {
          params: Promise.resolve({ playerId: ids.players[4] }),
        })
      ).status,
    ).toBe(204);
    const sessionResponse = await createSession(
      new Request("http://test/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          listId: list.id,
          name: suffix,
          format: "ROUND_ROBIN",
          gameRule: "ADVANTAGE",
          inputMode: "GAMES",
          scoringPreset: "RACE_TO_3",
          playerIds: ids.players.slice(0, 4),
          teams: [
            [ids.players[0], ids.players[3]],
            [ids.players[1], ids.players[2]],
          ],
          benchedIds: [],
        }),
      }),
    );
    expect(sessionResponse.status).toBe(201);
    const session = (await sessionResponse.json()) as {
      matches: Array<{ id: string; revision: number }>;
    };
    const match = session.matches[0];
    expect(
      (
        await scoreMatch(
          new Request("http://test", {
            method: "POST",
            body: JSON.stringify({
              revision: match.revision,
              action: "TEAM_GAME",
              winner: 0,
            }),
          }),
          { params: Promise.resolve({ matchId: match.id }) },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await scoreMatch(
          new Request("http://test", {
            method: "POST",
            body: JSON.stringify({
              revision: match.revision,
              action: "TEAM_GAME",
              winner: 0,
            }),
          }),
          { params: Promise.resolve({ matchId: match.id }) },
        )
      ).status,
    ).toBe(409);
  });
});
afterAll(async () => {
  if (ids.list) {
    await prisma.session.deleteMany({ where: { listId: ids.list } });
    await prisma.player.deleteMany({ where: { listId: ids.list } });
    await prisma.list.delete({ where: { id: ids.list } });
  }
  await prisma.$disconnect();
});
