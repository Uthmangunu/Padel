export type TeamIndex = 0 | 1;
export type Preset = "RACE_TO_3" | "RACE_TO_6" | "BEST_OF_3_STANDARD";
export type GameRule = "ADVANTAGE" | "GOLDEN_POINT";
export type ScoreEventType =
  "POINT" | "TEAM_GAME" | "TIEBREAK_GAME" | "TIEBREAK_WINNER" | "UNDO";
export type ScoreEvent = { type: ScoreEventType; winner?: TeamIndex };
export type SetScore = { games: [number, number]; tiebreak?: [number, number] };
export type MatchScore = {
  points: [number, number];
  games: [number, number];
  sets: [number, number];
  setScores: SetScore[];
  totalGames: [number, number];
  winner?: TeamIndex;
  tiebreak: [number, number] | null;
  clutch: { opportunities: [number, number]; wins: [number, number] };
};

export const initialScore = (): MatchScore => ({
  points: [0, 0],
  games: [0, 0],
  sets: [0, 0],
  setScores: [],
  totalGames: [0, 0],
  tiebreak: null,
  clutch: { opportunities: [0, 0], wins: [0, 0] },
});
const other = (team: TeamIndex): TeamIndex => (team === 0 ? 1 : 0);
const clone = (score: MatchScore) => structuredClone(score);
export const isTiebreak = (score: MatchScore) => score.tiebreak !== null;
const setComplete = (games: [number, number]) =>
  Math.max(...games) >= 6 &&
  (Math.abs(games[0] - games[1]) >= 2 || Math.max(...games) === 7);
const clutchPoint = (points: [number, number], rule: GameRule) =>
  rule === "GOLDEN_POINT"
    ? points[0] === 3 && points[1] === 3
    : points[0] >= 3 && points[1] >= 3;
function completeSet(score: MatchScore, winner: TeamIndex) {
  score.sets[winner] += 1;
  score.setScores.push({
    games: [...score.games] as [number, number],
    ...(score.tiebreak
      ? { tiebreak: [...score.tiebreak] as [number, number] }
      : {}),
  });
  score.games = [0, 0];
  score.points = [0, 0];
  score.tiebreak = null;
  if (score.sets[winner] === 2) score.winner = winner;
}
function awardGame(score: MatchScore, winner: TeamIndex, preset: Preset) {
  score.games[winner] += 1;
  score.totalGames[winner] += 1;
  score.points = [0, 0];
  if (preset === "RACE_TO_3" && score.games[winner] === 3)
    score.winner = winner;
  if (preset === "RACE_TO_6" && score.games[winner] === 6)
    score.winner = winner;
  if (preset === "BEST_OF_3_STANDARD") {
    if (score.games[0] === 6 && score.games[1] === 6) score.tiebreak = [0, 0];
    else if (setComplete(score.games)) completeSet(score, winner);
  }
}
function applyEvent(
  before: MatchScore,
  event: Exclude<ScoreEvent, { type: "UNDO" }>,
  preset: Preset,
  rule: GameRule,
): MatchScore {
  const score = clone(before);
  if (score.winner !== undefined || event.winner === undefined) return score;
  if (event.type === "TEAM_GAME") {
    if (!isTiebreak(score)) awardGame(score, event.winner, preset);
    return score;
  }
  if (event.type === "TIEBREAK_GAME" || event.type === "TIEBREAK_WINNER") {
    if (!isTiebreak(score)) return score;
    if (event.type === "TIEBREAK_WINNER") score.tiebreak![event.winner] = 7;
    else score.tiebreak![event.winner] += 1;
    const loser = other(event.winner);
    if (
      score.tiebreak![event.winner] >= 7 &&
      score.tiebreak![event.winner] - score.tiebreak![loser] >= 2
    ) {
      score.games[event.winner] += 1;
      score.totalGames[event.winner] += 1;
      completeSet(score, event.winner);
    }
    return score;
  }
  if (isTiebreak(score)) return score;
  const loser = other(event.winner);
  const wasClutch = clutchPoint(score.points, rule);
  if (wasClutch) {
    score.clutch.opportunities[0] += 1;
    score.clutch.opportunities[1] += 1;
    score.clutch.wins[event.winner] += 1;
  }
  score.points[event.winner] += 1;
  if (
    (rule === "GOLDEN_POINT" &&
      score.points[event.winner] >= 4 &&
      score.points[loser] >= 3) ||
    (rule === "ADVANTAGE" &&
      score.points[event.winner] >= 4 &&
      score.points[event.winner] - score.points[loser] >= 2)
  )
    awardGame(score, event.winner, preset);
  return score;
}
export function activeEvents(events: ScoreEvent[]) {
  const active: Exclude<ScoreEvent, { type: "UNDO" }>[] = [];
  for (const event of events) {
    if (event.type === "UNDO") active.pop();
    else active.push(event);
  }
  return active;
}
export function scoreFromEvents(
  events: ScoreEvent[],
  preset: Preset,
  rule: GameRule,
) {
  return activeEvents(events).reduce(
    (score, event) => applyEvent(score, event, preset, rule),
    initialScore(),
  );
}
export function reduceScore(
  before: MatchScore,
  event: ScoreEvent,
  preset: Preset,
  rule: GameRule,
) {
  return event.type === "UNDO"
    ? before
    : applyEvent(before, event, preset, rule);
}
export function pointLabel(value: number, opponent: number) {
  if (value < 3) return ["0", "15", "30"][value];
  if (value === 3 && opponent < 3) return "40";
  if (value === opponent) return "40";
  return value > opponent ? "AD" : "40";
}
export function displayPoints(score: MatchScore, rule?: GameRule) {
  void rule;
  return [
    pointLabel(score.points[0], score.points[1]),
    pointLabel(score.points[1], score.points[0]),
  ] as const;
}
