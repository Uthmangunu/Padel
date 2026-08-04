import type { Prisma } from "@prisma/client";
type Tx = Prisma.TransactionClient;
type Fixture = {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
  sequence: number;
};
type Completed = {
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId: string | null;
  homeGames: number;
  awayGames: number;
};
export function groupStandings(
  teamIds: string[],
  matches: Completed[],
  seeds: Map<string, number>,
) {
  const table = new Map(
    teamIds.map((id) => [id, { id, wins: 0, diff: 0, games: 0 }]),
  );
  for (const match of matches) {
    if (!match.winnerTeamId) continue;
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away) continue;
    home.diff += match.homeGames - match.awayGames;
    away.diff += match.awayGames - match.homeGames;
    home.games += match.homeGames;
    away.games += match.awayGames;
    table.get(match.winnerTeamId)!.wins += 1;
  }
  return [...table.values()].sort((a, b) => {
    const basic = b.wins - a.wins || b.diff - a.diff || b.games - a.games;
    if (basic) return basic;
    const direct = matches.find(
      (match) =>
        (match.homeTeamId === a.id && match.awayTeamId === b.id) ||
        (match.homeTeamId === b.id && match.awayTeamId === a.id),
    );
    if (direct?.winnerTeamId === a.id) return -1;
    if (direct?.winnerTeamId === b.id) return 1;
    return seeds.get(a.id)! - seeds.get(b.id)!;
  });
}

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
    const state = (session.progression as { queue?: string[] } | null) ?? {};
    const queue =
      state.queue ??
      session.teams
        .map((team) => team.id)
        .filter((id) => id !== winner && id !== loser);
    const challenger = queue[0];
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
    await tx.session.update({
      where: { id: sessionId },
      data: { progression: { queue: [...queue.slice(1), loser] } },
    });
    return;
  }
  if (session.format === "KNOCKOUT") {
    const lastRound = Math.max(...confirmed.map((match) => match.round));
    const round = confirmed.filter((match) => match.round === lastRound);
    if (round.length >= 1 && round.every((match) => match.winnerTeamId)) {
      const state =
        (session.progression as { byeTeams?: string[] } | null) ?? {};
      const winners = [
        ...round.map((match) => match.winnerTeamId!),
        ...(state.byeTeams ?? []),
      ];
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
        await tx.session.update({
          where: { id: sessionId },
          data: { progression: { byeTeams: [] } },
        });
        return;
      }
    }
  }
  if (session.format === "GROUPS_KNOCKOUT") {
    if (confirmed.some((match) => match.round === 3)) {
      await complete(tx, sessionId);
      return;
    }
    const groupRounds = confirmed.filter((match) => match.round === 1);
    if (groupRounds.length && confirmed.length === groupRounds.length) {
      const seeds = new Map(session.teams.map((team) => [team.id, team.seed]));
      const groupA = groupRounds.filter((match) => match.group === "A");
      const groupB = groupRounds.filter((match) => match.group === "B");
      const aTeams = [
        ...new Set(
          groupA.flatMap((match) => [match.homeTeamId, match.awayTeamId]),
        ),
      ];
      const bTeams = [
        ...new Set(
          groupB.flatMap((match) => [match.homeTeamId, match.awayTeamId]),
        ),
      ];
      const a = groupStandings(aTeams, groupA, seeds);
      const b = groupStandings(bTeams, groupB, seeds);
      if (a.length >= 2 && b.length >= 2) {
        await tx.match.createMany({
          data: [
            {
              sessionId,
              homeTeamId: a[0].id,
              awayTeamId: b[1].id,
              round: 2,
              sequence: session.matches.length,
              status: "LIVE",
              startedAt: new Date(),
            },
            {
              sessionId,
              homeTeamId: b[0].id,
              awayTeamId: a[1].id,
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
