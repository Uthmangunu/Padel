import { prisma } from "@/lib/prisma";
import { failure, AppError } from "@/lib/http";
import { importHistorySchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    const { rows } = importHistorySchema.parse(await req.json());
    for (const [index, row] of rows.entries()) {
      const names = [
        row.homePlayer1,
        row.homePlayer2,
        row.awayPlayer1,
        row.awayPlayer2,
      ].map((name) => name.trim().toLocaleLowerCase());
      if (new Set(names).size !== 4)
        throw new AppError(
          400,
          `Row ${index + 1}: choose four different players`,
        );
      if (row.homeGames === row.awayGames)
        throw new AppError(
          400,
          `Row ${index + 1}: completed games cannot end tied`,
        );
    }
    const imported = await prisma.$transaction(async (tx) => {
      const existing = await tx.player.findMany({ where: { listId } });
      const byName = new Map(
        existing.map((player) => [
          player.name.trim().toLocaleLowerCase(),
          player,
        ]),
      );
      const playerFor = async (name: string) => {
        const key = name.trim().toLocaleLowerCase();
        const known = byName.get(key);
        if (known) return known;
        const created = await tx.player.create({
          data: { listId, name: name.trim(), rating: 6, active: true },
        });
        byName.set(key, created);
        return created;
      };
      for (const row of rows) {
        const players = await Promise.all(
          [
            row.homePlayer1,
            row.homePlayer2,
            row.awayPlayer1,
            row.awayPlayer2,
          ].map(playerFor),
        );
        const playedAt = new Date(row.date);
        const session = await tx.session.create({
          data: {
            listId,
            name: `${row.matchType === "LEAGUE" ? "League" : "Casual"} import · ${playedAt.toLocaleDateString("en-CA")}`,
            format: row.matchType === "LEAGUE" ? "LEAGUE" : "ROUND_ROBIN",
            status: "COMPLETE",
            gameRule: "GOLDEN_POINT",
            inputMode: "GAMES",
            scoringPreset: "RACE_TO_3",
            createdAt: playedAt,
            startedAt: playedAt,
            completedAt: playedAt,
            participants: {
              create: players.map((player) => ({
                playerId: player.id,
                playerName: player.name,
                rating: player.rating,
              })),
            },
          },
          include: { participants: true },
        });
        const participantByPlayer = new Map(
          session.participants.map((participant) => [
            participant.playerId,
            participant,
          ]),
        );
        const [home, away] = await Promise.all(
          [
            [players[0], players[1]],
            [players[2], players[3]],
          ].map(async (pair, index) =>
            tx.team.create({
              data: {
                sessionId: session.id,
                seed: index + 1,
                name: pair.map((player) => player.name).join(" + "),
                totalRating: Number(pair[0].rating) + Number(pair[1].rating),
                members: {
                  create: pair.map((player) => ({
                    participantId: participantByPlayer.get(player.id)!.id,
                  })),
                },
              },
            }),
          ),
        );
        const homeWon = row.homeGames > row.awayGames;
        const winnerTeamId = homeWon ? home.id : away.id;
        const match = await tx.match.create({
          data: {
            sessionId: session.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            sequence: 0,
            status: "CONFIRMED",
            startedAt: playedAt,
            endedAt: playedAt,
            winnerTeamId,
            homeGames: row.homeGames,
            awayGames: row.awayGames,
            score: {
              totalGames: [row.homeGames, row.awayGames],
              winner: homeWon ? 0 : 1,
            },
          },
        });
        await tx.matchResult.create({
          data: {
            matchId: match.id,
            winnerTeamId,
            homeGames: row.homeGames,
            awayGames: row.awayGames,
            pointMode: false,
            confirmedAt: playedAt,
          },
        });
      }
      return rows.length;
    });
    return Response.json({ imported }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
