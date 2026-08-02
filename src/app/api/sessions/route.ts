import { prisma } from "@/lib/prisma";
import { failure, AppError } from "@/lib/http";
import { sessionSchema } from "@/lib/validation";
import { buildBalancedTeams } from "@/lib/teams";
import { knockout, roundRobin, groups } from "@/lib/formats";

export async function GET() {
  try {
    return Response.json(
      await prisma.session.findMany({
        include: {
          list: true,
          teams: {
            include: { members: { include: { participant: true } } },
            orderBy: { seed: "asc" },
          },
          matches: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: Request) {
  try {
    const input = sessionSchema.parse(await req.json());
    const players = await prisma.player.findMany({
      where: {
        id: { in: input.playerIds },
        listId: input.listId,
        active: true,
      },
    });
    if (players.length !== input.playerIds.length)
      throw new AppError(400, "Choose active players from this list");
    const candidateMap = new Map(
      players.map((p) => [
        p.id,
        { id: p.id, name: p.name, rating: Number(p.rating) },
      ]),
    );
    const built = input.teams
      ? (() => {
          const ids = input.teams.flat();
          if (
            new Set(ids).size !== ids.length ||
            ids.some((id) => !candidateMap.has(id))
          )
            throw new AppError(
              400,
              "Teams must contain selected players exactly once",
            );
          return {
            teams: input.teams.map((pair) => ({
              members: [
                candidateMap.get(pair[0])!,
                candidateMap.get(pair[1])!,
              ] as const,
              total:
                candidateMap.get(pair[0])!.rating +
                candidateMap.get(pair[1])!.rating,
            })),
            benched: players
              .filter((player) => !ids.includes(player.id))
              .map((player) => candidateMap.get(player.id)!),
            imbalance: 0,
          };
        })()
      : buildBalancedTeams(
          players.map((p) => ({
            id: p.id,
            name: p.name,
            rating: Number(p.rating),
          })),
          input.constraints,
        );
    if (input.format === "WINNER_STAYS" && built.teams.length < 3)
      throw new AppError(400, "Winner Stays On requires at least three teams");
    if (input.format === "GROUPS_KNOCKOUT" && built.teams.length < 4)
      throw new AppError(400, "Groups + Knockout requires at least four teams");
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          listId: input.listId,
          name: input.name,
          format: input.format,
          gameRule: input.gameRule,
          inputMode: input.inputMode,
          scoringPreset: input.scoringPreset,
          status: "ACTIVE",
          startedAt: new Date(),
          participants: {
            create: players.map((p) => ({
              playerId: p.id,
              playerName: p.name,
              rating: p.rating,
              benched: built.benched.some((b) => b.id === p.id),
            })),
          },
        },
      });
      const participants = await tx.participant.findMany({
        where: { sessionId: created.id },
      });
      const teams = await Promise.all(
        built.teams.map((team, index) =>
          tx.team.create({
            data: {
              sessionId: created.id,
              seed: index + 1,
              name: team.members.map((m) => m.name).join(" + "),
              totalRating: team.total,
              members: {
                create: team.members.map((m) => ({
                  participantId: participants.find((p) => p.playerId === m.id)!
                    .id,
                })),
              },
            },
          }),
        ),
      );
      let fixtures =
        input.format === "ROUND_ROBIN"
          ? roundRobin(teams)
          : input.format === "GROUPS_KNOCKOUT"
            ? (() => {
                const split = groups(teams);
                return [
                  ...roundRobin(split.a, "A"),
                  ...roundRobin(split.b, "B"),
                ].map((fixture, sequence) => ({ ...fixture, sequence }));
              })()
            : knockout(teams);
      if (input.format === "WINNER_STAYS")
        fixtures = [
          { homeId: teams[0].id, awayId: teams[1].id, round: 1, sequence: 0 },
        ];
      await tx.match.createMany({
        data: fixtures.map((fixture) => ({
          homeTeamId: fixture.homeId,
          awayTeamId: fixture.awayId,
          round: fixture.round,
          sequence: fixture.sequence,
          sessionId: created.id,
          status: fixture.sequence === 0 ? "LIVE" : "PENDING",
        })),
      });
      return tx.session.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          teams: { include: { members: { include: { participant: true } } } },
          matches: true,
          participants: true,
        },
      });
    });
    return Response.json(session, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
