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
  const force = new Map<string, string>(),
    blocked = new Set<string>();
  constraints.forEach((c) =>
    c.type === "FORCE"
      ? (force.set(c.playerA, c.playerB), force.set(c.playerB, c.playerA))
      : blocked.add(key(c.playerA, c.playerB)),
  );
  for (const [a, b] of force)
    if (force.get(b) !== a || blocked.has(key(a, b)))
      throw new Error("Contradictory team constraints");
  const benched = sorted.length % 2 ? [sorted.at(-1)!] : [];
  const pool = sorted.slice(0, sorted.length - benched.length);
  let best: BuiltTeam[] | undefined;
  let bestGap = Infinity;
  function walk(remaining: Candidate[], teams: BuiltTeam[]) {
    if (!remaining.length) {
      const signature = teams
        .map((t) =>
          t.members
            .map((p) => p.id)
            .sort()
            .join("-"),
        )
        .sort();
      const gap =
        Math.max(...teams.map((t) => t.total)) -
        Math.min(...teams.map((t) => t.total));
      if (
        gap < bestGap &&
        !excluded.some((x) => x.join("|") === signature.join("|"))
      ) {
        bestGap = gap;
        best = teams;
      }
      return;
    }
    const first = remaining[0];
    for (let i = 1; i < remaining.length; i++) {
      const second = remaining[i];
      if (
        (force.get(first.id) && force.get(first.id) !== second.id) ||
        blocked.has(key(first.id, second.id))
      )
        continue;
      const rest = remaining.filter((p) => p !== first && p !== second);
      walk(rest, [
        ...teams,
        { members: [first, second], total: first.rating + second.rating },
      ]);
    }
  }
  walk(pool, []);
  if (!best)
    throw new Error("Constraints cannot produce valid two-player teams");
  return { teams: best, benched, imbalance: bestGap };
}
export function lineupSignature(result: BuildResult) {
  return result.teams
    .map((t) =>
      t.members
        .map((p) => p.id)
        .sort()
        .join("-"),
    )
    .sort();
}
