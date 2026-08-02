export type FormatTeam = { id: string; seed: number };
export type Fixture = {
  homeId: string;
  awayId: string;
  round: number;
  sequence: number;
  bye?: boolean;
  group?: "A" | "B";
};
export type StandingTeam = { id: string; name: string; seed: number };
export type StandingMatch = {
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId: string | null;
  homeGames: number;
  awayGames: number;
  status: string;
};
export function roundRobinStandings(
  teams: StandingTeam[],
  matches: StandingMatch[],
) {
  const rows = new Map(
    teams.map((team) => [
      team.id,
      { ...team, played: 0, wins: 0, gameDiff: 0, gamesWon: 0 },
    ]),
  );
  for (const match of matches.filter((match) => match.status === "CONFIRMED")) {
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.gameDiff += match.homeGames - match.awayGames;
    away.gameDiff += match.awayGames - match.homeGames;
    home.gamesWon += match.homeGames;
    away.gamesWon += match.awayGames;
    if (match.winnerTeamId) rows.get(match.winnerTeamId)!.wins++;
  }
  return [...rows.values()].sort((a, b) => {
    const basic =
      b.wins - a.wins || b.gameDiff - a.gameDiff || b.gamesWon - a.gamesWon;
    if (basic) return basic;
    const direct = matches.find(
      (match) =>
        match.status === "CONFIRMED" &&
        ((match.homeTeamId === a.id && match.awayTeamId === b.id) ||
          (match.homeTeamId === b.id && match.awayTeamId === a.id)),
    );
    if (direct?.winnerTeamId === a.id) return -1;
    if (direct?.winnerTeamId === b.id) return 1;
    return a.seed - b.seed;
  });
}
export function roundRobin(teams: FormatTeam[], group?: "A" | "B"): Fixture[] {
  const out: Fixture[] = [];
  let sequence = 0;
  for (let home = 0; home < teams.length; home += 1)
    for (let away = home + 1; away < teams.length; away += 1)
      out.push({
        homeId: teams[home].id,
        awayId: teams[away].id,
        round: 1,
        sequence: sequence++,
        ...(group ? { group } : {}),
      });
  return out;
}
export function knockout(teams: FormatTeam[]): Fixture[] {
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);
  const base = 2 ** Math.floor(Math.log2(Math.max(2, sorted.length)));
  const playInTeams = 2 * (sorted.length - base);
  const firstPlayIn = sorted.length - playInTeams;
  const out: Fixture[] = [];
  if (sorted.length === base) {
    for (let index = 0; index < sorted.length / 2; index += 1)
      out.push({
        homeId: sorted[index].id,
        awayId: sorted[sorted.length - 1 - index].id,
        round: 1,
        sequence: index,
      });
    return out;
  }
  for (let index = 0; index < playInTeams / 2; index += 1) {
    const home = sorted[firstPlayIn + index];
    const away = sorted[sorted.length - 1 - index];
    if (home && away) {
      out.push({ homeId: home.id, awayId: away.id, round: 1, sequence: index });
    }
  }
  return out;
}
export function groups(teams: FormatTeam[]) {
  if (teams.length < 4)
    throw new Error("Groups + Knockout needs at least four teams");
  const a: FormatTeam[] = [];
  const b: FormatTeam[] = [];
  [...teams]
    .sort((x, y) => x.seed - y.seed)
    .forEach((team, index) =>
      ((Math.floor(index / 2) % 2 === 0 ? index % 2 === 0 : index % 2 !== 0)
        ? a
        : b
      ).push(team),
    );
  return { a, b };
}
export function winnerStaysNext(
  queue: string[],
  winnerId: string,
  loserId: string,
) {
  return [...queue.filter((id) => id !== winnerId && id !== loserId), loserId];
}
