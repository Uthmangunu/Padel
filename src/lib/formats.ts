export type FormatTeam = { id: string; seed: number };
export type Fixture = {
  homeId: string;
  awayId: string;
  round: number;
  sequence: number;
  bye?: boolean;
  group?: "A" | "B";
};
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
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, sorted.length)));
  const out: Fixture[] = [];
  for (let index = 0; index < size / 2; index += 1) {
    const home = sorted[index];
    const away = sorted[size - 1 - index];
    if (home && away)
      out.push({ homeId: home.id, awayId: away.id, round: 1, sequence: index });
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
