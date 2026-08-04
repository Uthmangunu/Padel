import { prisma } from "@/lib/prisma";
import { failure, AppError } from "@/lib/http";
import { sessionSchema } from "@/lib/validation";
import { buildBalancedTeams } from "@/lib/teams";
import { knockout, roundRobin, groups } from "@/lib/formats";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const listId = url.searchParams.get("listId");
    const status = url.searchParams.get("status");
    return Response.json(
      await prisma.session.findMany({
        where: {
          ...(listId ? { listId } : {}),
          ...(status
            ? { status: status as "SETUP" | "ACTIVE" | "COMPLETE" }
            : {}),
        },
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
          const benched = input.benchedIds ?? [];
          if (
            new Set([...ids, ...benched]).size !==
              ids.length + benched.length ||
            ids.some((id) => !candidateMap.has(id)) ||
            benched.some((id) => !candidateMap.has(id)) ||
            [...candidateMap.keys()].some(
              (id) => !ids.includes(id) && !benched.includes(id),
            )
          )
            throw new AppError(
              400,
              "Every selected player must appear once in a team or the explicit bench",
            );
          for (const constraint of input.constraints ?? []) {
            const together = input.teams.some(
              (pair) =>
                pair.includes(constraint.playerA) &&
                pair.includes(constraint.playerB),
            );
            if (
              (constraint.type === "FORCE" && !together) ||
              (constraint.type === "BLOCK" && together)
            )
              throw new AppError(400, "Manual teams violate a pair constraint");
          }
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
              .filter((player) => benched.includes(player.id))
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
    if (
      (input.format === "ROUND_ROBIN" || input.format === "KNOCKOUT") &&
      built.teams.length < 2
    )
      throw new AppError(400, "This format requires at least two teams");
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
      if (input.format === "WINNER_STAYS")
        await tx.session.update({
          where: { id: created.id },
          data: {
            progression: { queue: teams.slice(2).map((team) => team.id) },
          },
        });
      if (input.format === "KNOCKOUT") {
        const base = 2 ** Math.floor(Math.log2(Math.max(2, teams.length)));
        const byeCount = teams.length - 2 * (teams.length - base);
        await tx.session.update({
          where: { id: created.id },
          data: {
            progression: {
              byeTeams: teams.slice(0, byeCount).map((team) => team.id),
            },
          },
        });
      }
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
          group: fixture.group,
          sessionId: created.id,
          status: fixture.sequence === 0 ? "LIVE" : "PENDING",
          ...(fixture.sequence === 0 ? { startedAt: new Date() } : {}),
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
