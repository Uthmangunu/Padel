export type Candidate = { id: string; name: string; rating: number };
export type Constraint = {
  type: "FORCE" | "BLOCK";
  playerA: string;
  playerB: string;
};
export type BuiltTeam = { members: [Candidate, Candidate]; total: number };
export type BuildResult = {
  teams: BuiltTeam[];
  benched: Candidate[];
  imbalance: number;
};
const key = (a: string, b: string) => [a, b].sort().join(":");
export function buildBalancedTeams(
  players: Candidate[],
  constraints: Constraint[] = [],
  excluded: string[][] = [],
): BuildResult {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const force = new Map<string, string>();
  const blocked = new Set<string>();
  constraints.forEach((constraint) =>
    constraint.type === "FORCE"
      ? (force.set(constraint.playerA, constraint.playerB),
        force.set(constraint.playerB, constraint.playerA))
      : blocked.add(key(constraint.playerA, constraint.playerB)),
  );
  for (const [a, b] of force)
    if (force.get(b) !== a || blocked.has(key(a, b)))
      throw new Error("Contradictory team constraints");
  const benches =
    sorted.length % 2
      ? sorted.filter((candidate) => !force.has(candidate.id))
      : [undefined];
  let best: BuildResult | undefined;
  for (const bench of benches) {
    const pool = sorted.filter((candidate) => candidate !== bench);
    let candidateBest: BuiltTeam[] | undefined;
    let bestGap = Infinity;
    const walk = (remaining: Candidate[], teams: BuiltTeam[]) => {
      if (!remaining.length) {
        const signature = signatureFor(teams);
        const gap =
          Math.max(...teams.map((team) => team.total)) -
          Math.min(...teams.map((team) => team.total));
        if (
          gap < bestGap &&
          !excluded.some((lineup) => lineup.join("|") === signature.join("|"))
        ) {
          bestGap = gap;
          candidateBest = teams;
        }
        return;
      }
      const first = remaining[0];
      const possible = remaining
        .slice(1)
        .filter(
          (second) =>
            (!force.get(first.id) || force.get(first.id) === second.id) &&
            !blocked.has(key(first.id, second.id)),
        )
        .sort((a, b) => first.rating + a.rating - (first.rating + b.rating))
        .slice(0, 4);
      for (const second of possible)
        walk(
          remaining.filter(
            (candidate) => candidate !== first && candidate !== second,
          ),
          [
            ...teams,
            { members: [first, second], total: first.rating + second.rating },
          ],
        );
    };
    walk(pool, []);
    if (candidateBest) {
      const result = {
        teams: candidateBest,
        benched: bench ? [bench] : [],
        imbalance: bestGap,
      };
      if (!best || result.imbalance < best.imbalance) best = result;
    }
  }
  if (!best)
    throw new Error("Constraints cannot produce valid two-player teams");
  return best;
}
function signatureFor(teams: BuiltTeam[]) {
  return teams
    .map((team) =>
      team.members
        .map((player) => player.id)
        .sort()
        .join("-"),
    )
    .sort();
}
export function lineupSignature(result: BuildResult) {
  return signatureFor(result.teams);
}
