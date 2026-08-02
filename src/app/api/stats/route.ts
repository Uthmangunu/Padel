import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/http";
import { expectedWin } from "@/lib/stats";
type ScoreJson = {
  clutch?: { opportunities: [number, number]; wins: [number, number] };
};
type PlayerRecord = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  games: number;
  expected: number;
  current: number;
  best: number;
  clutchWins: number;
  clutchOpportunities: number;
  eligible: number;
  partners: Map<string, { wins: number; games: number }>;
  h2h: Map<string, { wins: number; losses: number }>;
  trend: boolean[];
};
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const listId = url.searchParams.get("listId");
    if (!listId)
      return Response.json({ error: "listId required" }, { status: 400 });
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const matches = await prisma.match.findMany({
      where: {
        session: { listId },
        status: "CONFIRMED",
        ...(from || to
          ? {
              endedAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { endedAt: "asc" },
      include: {
        homeTeam: { include: { members: { include: { participant: true } } } },
        awayTeam: { include: { members: { include: { participant: true } } } },
        result: true,
      },
    });
    const records = new Map<string, PlayerRecord>();
    const ensure = (id: string, name: string) => {
      let value = records.get(id);
      if (!value) {
        value = {
          id,
          name,
          wins: 0,
          losses: 0,
          games: 0,
          expected: 0,
          current: 0,
          best: 0,
          clutchWins: 0,
          clutchOpportunities: 0,
          eligible: 0,
          partners: new Map(),
          h2h: new Map(),
          trend: [],
        };
        records.set(id, value);
      }
      return value;
    };
    for (const match of matches) {
      const home = match.homeTeam.members.map((member) => member.participant);
      const away = match.awayTeam.members.map((member) => member.participant);
      const homeWon = match.winnerTeamId === match.homeTeamId;
      const homeRating = Number(match.homeTeam.totalRating) / 2;
      const awayRating = Number(match.awayTeam.totalRating) / 2;
      const score = match.score as ScoreJson | null;
      for (const [
        side,
        own,
        opponents,
        won,
        ownGames,
        opponentGames,
        ownRating,
        opponentRating,
      ] of [
        [
          0,
          home,
          away,
          homeWon,
          match.homeGames,
          match.awayGames,
          homeRating,
          awayRating,
        ],
        [
          1,
          away,
          home,
          !homeWon,
          match.awayGames,
          match.homeGames,
          awayRating,
          homeRating,
        ],
      ] as const)
        for (const player of own) {
          const record = ensure(player.playerId, player.playerName);
          if (won) record.wins += 1;
          else record.losses += 1;
          record.games += ownGames - opponentGames;
          record.expected += expectedWin(ownRating, opponentRating);
          record.current = won
            ? Math.max(1, record.current + 1)
            : Math.min(-1, record.current - 1);
          record.best = Math.max(record.best, record.current);
          record.trend.push(won);
          if (match.result!.pointMode && score?.clutch) {
            record.eligible += 1;
            record.clutchWins += score.clutch.wins[side];
            record.clutchOpportunities += score.clutch.opportunities[side];
          }
          for (const partner of own.filter(
            (candidate) => candidate.id !== player.id,
          )) {
            const pair = record.partners.get(partner.playerId) ?? {
              wins: 0,
              games: 0,
            };
            pair.games += 1;
            if (won) pair.wins += 1;
            record.partners.set(partner.playerId, pair);
          }
          for (const opponent of opponents) {
            const h2h = record.h2h.get(opponent.playerId) ?? {
              wins: 0,
              losses: 0,
            };
            if (won) h2h.wins += 1;
            else h2h.losses += 1;
            record.h2h.set(opponent.playerId, h2h);
          }
        }
    }
    const players = [...records.values()].map((record) => {
      const qualified = [...record.partners.entries()]
        .filter(([, value]) => value.games >= 3)
        .sort((a, b) => a[1].wins / a[1].games - b[1].wins / b[1].games);
      return {
        id: record.id,
        name: record.name,
        wins: record.wins,
        losses: record.losses,
        winRate:
          record.wins + record.losses
            ? record.wins / (record.wins + record.losses)
            : 0,
        gamesDifferential: record.games,
        performanceVsExpected: record.wins - record.expected,
        currentStreak: record.current,
        bestStreak: record.best,
        clutch: {
          wins: record.clutchWins,
          opportunities: record.clutchOpportunities,
          eligibleMatches: record.eligible,
        },
        bestPartner: qualified.at(-1)?.[0] ?? null,
        worstPartner: qualified[0]?.[0] ?? null,
        headToHead: Object.fromEntries(record.h2h),
        rolling10: record.trend.slice(-10),
      };
    });
    return Response.json({
      coverage: {
        pointModeMatches: matches.filter((match) => match.result!.pointMode)
          .length,
        totalMatches: matches.length,
      },
      players,
    });
  } catch (error) {
    return failure(error);
  }
}
