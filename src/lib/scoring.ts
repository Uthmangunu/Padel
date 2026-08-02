export type TeamIndex = 0 | 1;
export type Preset = "RACE_TO_3" | "RACE_TO_6" | "BEST_OF_3_STANDARD";
export type GameRule = "ADVANTAGE" | "GOLDEN_POINT";
export type ScoreEvent = { type: "POINT" | "TEAM_GAME" | "TIEBREAK_GAME"; winner: TeamIndex };
export type SetScore = { games: [number, number]; tiebreak?: [number, number] };
export type MatchScore = { points: [number, number]; games: [number, number]; sets: [number, number]; setScores: SetScore[]; winner?: TeamIndex; clutch: { opportunities: [number, number]; wins: [number, number] } };

export const initialScore = (): MatchScore => ({ points: [0, 0], games: [0, 0], sets: [0, 0], setScores: [], clutch: { opportunities: [0, 0], wins: [0, 0] } });
const isTiebreak = (s: MatchScore) => s.games[0] === 6 && s.games[1] === 6;
const setDone = (g: [number, number]) => (Math.max(...g) >= 6 && Math.abs(g[0] - g[1]) >= 2) || Math.max(...g) === 7;
const clone = (s: MatchScore): MatchScore => structuredClone(s);
const gameIsClutch = (p: [number, number], golden: boolean) => golden ? p[0] === 3 && p[1] === 3 : (p[0] >= 3 && p[1] >= 3);
function addSetOrWin(s: MatchScore, winner: TeamIndex, preset: Preset) {
  if (preset !== "BEST_OF_3_STANDARD") { s.winner = winner; return; }
  s.sets[winner]++;
  s.setScores.push({ games: [...s.games] as [number, number] });
  s.games = [0, 0]; s.points = [0, 0];
  if (s.sets[winner] === 2) s.winner = winner;
}
function gameWon(s: MatchScore, winner: TeamIndex, preset: Preset) {
  s.games[winner]++; s.points = [0, 0];
  if (preset === "RACE_TO_3" && s.games[winner] >= 3) s.winner = winner;
  if (preset === "RACE_TO_6" && s.games[winner] >= 6) s.winner = winner;
  if (preset === "BEST_OF_3_STANDARD" && setDone(s.games)) addSetOrWin(s, winner, preset);
}
export function reduceScore(before: MatchScore, event: ScoreEvent, preset: Preset, rule: GameRule): MatchScore {
  const s = clone(before); if (s.winner !== undefined) return s;
  if (event.type === "TEAM_GAME") { gameWon(s, event.winner, preset); return s; }
  if (event.type === "TIEBREAK_GAME") {
    if (!isTiebreak(s)) return s;
    const tb = s.setScores.at(-1)?.tiebreak ?? [0, 0]; tb[event.winner]++;
    const other = event.winner === 0 ? 1 : 0;
    if (tb[event.winner] >= 7 && tb[event.winner] - tb[other] >= 2) { s.games[event.winner]++; s.setScores.push({ games: [7, 6], tiebreak: tb }); addSetOrWin(s,event.winner,preset); }
    else s.setScores = [...s.setScores.filter((x) => !x.tiebreak), { games: [6,6], tiebreak: tb }];
    return s;
  }
  if (isTiebreak(s)) return s;
  const other = event.winner === 0 ? 1 : 0;
  const clutch = gameIsClutch(s.points, rule === "GOLDEN_POINT");
  if (clutch) { s.clutch.opportunities[event.winner]++; s.clutch.opportunities[other]++; s.clutch.wins[event.winner]++; }
  s.points[event.winner]++;
  if (rule === "GOLDEN_POINT" && s.points[event.winner] >= 4 && s.points[other] >= 3) gameWon(s,event.winner,preset);
  else if (s.points[event.winner] >= 4 && s.points[event.winner] - s.points[other] >= 2) gameWon(s,event.winner,preset);
  return s;
}
export function scoreFromEvents(events: ScoreEvent[], preset: Preset, rule: GameRule) { return events.reduce((score, event) => reduceScore(score,event,preset,rule), initialScore()); }
export function pointLabel(value: number, opponent: number) { if (value < 3) return ["0","15","30"][value]; if (value === 3 && opponent < 3) return "40"; if (value === opponent) return "40"; return value > opponent ? "AD" : "40"; }
export function displayPoints(score: MatchScore, rule: GameRule) { void rule; return [pointLabel(score.points[0],score.points[1]),pointLabel(score.points[1],score.points[0])] as const; }
