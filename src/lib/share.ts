export function formatMatchShare(input: {
  session: string;
  home: string;
  away: string;
  score: string;
  winner: string;
}) {
  return `🎾 ${input.session}\n${input.home} vs ${input.away}\nScore: ${input.score}\nWinner: ${input.winner}\n\nTracked with Padel Manager`;
}
export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
export function formatSessionShare(input: {
  session: string;
  format: string;
  fixtures: Array<{
    home: string;
    away: string;
    score?: string;
    winner?: string;
  }>;
}) {
  return `🎾 ${input.session}\nFormat: ${input.format}\n\n${input.fixtures.map((fixture) => `${fixture.home} vs ${fixture.away}${fixture.score ? ` — ${fixture.score}` : ""}${fixture.winner ? ` (${fixture.winner})` : ""}`).join("\n")}\n\nTracked with Padel Manager`;
}
