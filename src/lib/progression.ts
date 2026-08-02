import type { Prisma } from "@prisma/client";
type Tx = Prisma.TransactionClient;
type Fixture = {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  sequence: number;
};

/** Keeps the one-court invariant in the same transaction as confirmation. */
export async function advanceSession(tx: Tx, sessionId: string) {
  const session = await tx.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      matches: { orderBy: { sequence: "asc" } },
      teams: { orderBy: { seed: "asc" } },
    },
  });
  const live = session.matches.find(
    (match) =>
      match.status === "LIVE" || match.status === "AWAITING_CONFIRMATION",
  );
  if (live) return;
  const pending = session.matches.find((match) => match.status === "PENDING");
  if (pending) {
    await tx.match.update({
      where: { id: pending.id },
      data: { status: "LIVE", startedAt: new Date() },
    });
    return;
  }
  const confirmed = session.matches.filter(
    (match) => match.status === "CONFIRMED",
  );
  if (session.format === "WINNER_STAYS") {
    const last = confirmed.at(-1);
    if (!last || session.teams.length < 3) {
      await complete(tx, sessionId);
      return;
    }
    const winner = last.winnerTeamId!;
    const loser =
      last.homeTeamId === winner ? last.awayTeamId : last.homeTeamId;
    const queued = session.teams
      .map((team) => team.id)
      .filter((id) => id !== winner && id !== loser);
    const challenger = queued[0];
    if (!challenger) {
      await complete(tx, sessionId);
      return;
    }
    await tx.match.create({
      data: {
        sessionId,
        homeTeamId: winner,
        awayTeamId: challenger,
        round: last.round + 1,
        sequence: last.sequence + 1,
        status: "LIVE",
        startedAt: new Date(),
      },
    });
    return;
  }
  if (session.format === "KNOCKOUT") {
    const lastRound = Math.max(...confirmed.map((match) => match.round));
    const round = confirmed.filter((match) => match.round === lastRound);
    if (round.length >= 1 && round.every((match) => match.winnerTeamId)) {
      const winners = round.map((match) => match.winnerTeamId!);
      if (winners.length === 1) {
        await complete(tx, sessionId);
        return;
      }
      const fixtures: Fixture[] = [];
      for (let index = 0; index < winners.length; index += 2)
        if (winners[index + 1])
          fixtures.push({
            homeTeamId: winners[index],
            awayTeamId: winners[index + 1],
            round: lastRound + 1,
            sequence: session.matches.length + fixtures.length,
          });
      if (fixtures.length) {
        await tx.match.createMany({
          data: fixtures.map((fixture, index) => ({
            ...fixture,
            sessionId,
            status: index === 0 ? "LIVE" : "PENDING",
            ...(index === 0 ? { startedAt: new Date() } : {}),
          })),
        });
        return;
      }
    }
  }
  if (session.format === "GROUPS_KNOCKOUT") {
    const groupRounds = confirmed.filter((match) => match.round === 1);
    if (groupRounds.length && confirmed.length === groupRounds.length) {
      const tally = new Map<string, number>();
      for (const match of groupRounds)
        tally.set(
          match.winnerTeamId!,
          (tally.get(match.winnerTeamId!) ?? 0) + 1,
        );
      const seeds = [...tally].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      if (seeds.length >= 4) {
        await tx.match.createMany({
          data: [
            {
              sessionId,
              homeTeamId: seeds[0],
              awayTeamId: seeds[3],
              round: 2,
              sequence: session.matches.length,
              status: "LIVE",
              startedAt: new Date(),
            },
            {
              sessionId,
              homeTeamId: seeds[1],
              awayTeamId: seeds[2],
              round: 2,
              sequence: session.matches.length + 1,
              status: "PENDING",
            },
          ],
        });
        return;
      }
    }
    const semi = confirmed.filter((match) => match.round === 2);
    if (semi.length === 2) {
      await tx.match.create({
        data: {
          sessionId,
          homeTeamId: semi[0].winnerTeamId!,
          awayTeamId: semi[1].winnerTeamId!,
          round: 3,
          sequence: session.matches.length,
          status: "LIVE",
          startedAt: new Date(),
        },
      });
      return;
    }
  }
  await complete(tx, sessionId);
}
async function complete(tx: Tx, sessionId: string) {
  await tx.session.update({
    where: { id: sessionId },
    data: { status: "COMPLETE", completedAt: new Date() },
  });
}
