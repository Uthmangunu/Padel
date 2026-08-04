import { describe, it, expect } from "vitest";
import { buildBalancedTeams, lineupSignature } from "./teams";
const p = [9, 8, 7, 6, 5, 4].map((rating, i) => ({
  id: String(i),
  name: String(i),
  rating,
}));
describe("team builder", () => {
  it("balances pairs", () => {
    const x = buildBalancedTeams(p);
    expect(x.imbalance).toBeLessThanOrEqual(1);
    expect(x.teams).toHaveLength(3);
  });
  it("benches an odd player", () => {
    expect(buildBalancedTeams(p.slice(0, 5)).benched).toHaveLength(1);
  });
  it("honours forced pairs", () => {
    const x = buildBalancedTeams(p, [
      { type: "FORCE", playerA: "0", playerB: "5" },
    ]);
    expect(lineupSignature(x).some((x) => x === "0-5")).toBe(true);
  });
  it("rejects contradictory pairs", () =>
    expect(() =>
      buildBalancedTeams(p, [
        { type: "FORCE", playerA: "0", playerB: "1" },
        { type: "BLOCK", playerA: "0", playerB: "1" },
      ]),
    ).toThrow());
  it("does not return an excluded valid lineup", () => {
    const first = buildBalancedTeams(p);
    const second = buildBalancedTeams(p, [], [lineupSignature(first)]);
    expect(lineupSignature(second)).not.toEqual(lineupSignature(first));
  });
  it("benches a feasible player instead of breaking a forced lowest-rated pair", () => {
    const roster = [...p.slice(0, 4), { id: "low", name: "low", rating: 1 }];
    const result = buildBalancedTeams(roster, [
      { type: "FORCE", playerA: "low", playerB: "0" },
    ]);
    expect(result.benched[0].id).not.toBe("low");
  });
  it("generates the default sixteen-player scale within a practical bound", () => {
    const roster = Array.from({ length: 16 }, (_, index) => ({
      id: String(index),
      name: String(index),
      rating: 10 - index / 2,
    }));
    const start = performance.now();
    expect(buildBalancedTeams(roster).teams).toHaveLength(8);
    expect(performance.now() - start).toBeLessThan(500);
  });
});
