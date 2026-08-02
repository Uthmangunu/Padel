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
