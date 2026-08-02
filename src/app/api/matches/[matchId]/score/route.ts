import { prisma } from "@/lib/prisma";
import { failure, AppError } from "@/lib/http";
import { scoreActionSchema } from "@/lib/validation";
import { scoreFromEvents, type Preset, type ScoreEvent } from "@/lib/scoring";
import { advanceSession } from "@/lib/progression";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params;
    const input = scoreActionSchema.parse(await req.json());
    const match = await prisma.$transaction(async (tx) => {
      const current = await tx.match.findUniqueOrThrow({
        where: { id: matchId },
        include: { events: { orderBy: { sequence: "asc" } }, session: true },
      });
      if (current.revision !== input.revision)
        throw new AppError(
          409,
          "This match changed elsewhere. Refresh and try again.",
        );
      if (current.status === "CONFIRMED")
        throw new AppError(400, "Confirmed results cannot be changed");
      const events: ScoreEvent[] = current.events.map((event) => ({
        type: event.type,
        ...(event.winner === null ? {} : { winner: event.winner as 0 | 1 }),
      }));
      const score = scoreFromEvents(
        events,
        current.session.scoringPreset as Preset,
        current.session.gameRule,
      );
      if (input.action === "CONFIRM") {
        if (
          score.winner === undefined ||
          current.status !== "AWAITING_CONFIRMATION"
        )
          throw new AppError(400, "Finish the match before confirming it");
        const winnerTeamId =
          score.winner === 0 ? current.homeTeamId : current.awayTeamId;
        await tx.matchResult.create({
          data: {
            matchId,
            winnerTeamId,
            homeGames: score.totalGames[0],
            awayGames: score.totalGames[1],
            pointMode: current.session.inputMode === "POINTS",
          },
        });
        const confirmed = await tx.match.update({
          where: { id: matchId },
          data: {
            status: "CONFIRMED",
            winnerTeamId,
            endedAt: new Date(),
            score,
            homeGames: score.totalGames[0],
            awayGames: score.totalGames[1],
            homeSets: score.sets[0],
            awaySets: score.sets[1],
            revision: { increment: 1 },
          },
        });
        await advanceSession(tx, current.sessionId);
        return confirmed;
      }
      if (input.action === "UNDO") {
        if (!events.length) throw new AppError(400, "There is nothing to undo");
      } else {
        if (input.winner === undefined)
          throw new AppError(400, "Choose a winning team");
        if (
          current.status !== "LIVE" &&
          current.status !== "AWAITING_CONFIRMATION"
        )
          throw new AppError(400, "Only the live match may be scored");
        if (
          current.session.inputMode === "POINTS" &&
          input.action !== "POINT" &&
          !(score.tiebreak && input.action === "TIEBREAK_GAME")
        )
          throw new AppError(
            400,
            "Point-mode matches accept points, or tiebreak points at 6–6",
          );
        if (current.session.inputMode === "GAMES" && input.action === "POINT")
          throw new AppError(
            400,
            "Game-mode matches cannot accept individual points",
          );
        if (input.action === "TIEBREAK_GAME" && !score.tiebreak)
          throw new AppError(400, "A tiebreak is only available at 6–6");
        if (input.action === "TEAM_GAME" && score.tiebreak)
          throw new AppError(
            400,
            "Choose the tiebreak winner point-by-point at 6–6",
          );
      }
      const event =
        input.action === "UNDO"
          ? { type: "UNDO" as const }
          : { type: input.action, winner: input.winner! };
      await tx.scoreEvent.create({
        data: {
          matchId,
          sequence: current.events.length + 1,
          type: event.type,
          ...(event.type === "UNDO" ? {} : { winner: event.winner }),
        },
      });
      const next = scoreFromEvents(
        [...events, event],
        current.session.scoringPreset as Preset,
        current.session.gameRule,
      );
      return tx.match.update({
        where: { id: matchId },
        data: {
          score: next,
          homeGames: next.totalGames[0],
          awayGames: next.totalGames[1],
          homeSets: next.sets[0],
          awaySets: next.sets[1],
          status: next.winner === undefined ? "LIVE" : "AWAITING_CONFIRMATION",
          revision: { increment: 1 },
        },
      });
    });
    return Response.json(match);
  } catch (error) {
    return failure(error);
  }
}
