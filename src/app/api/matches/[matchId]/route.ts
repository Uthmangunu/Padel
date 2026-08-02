import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await params;
    const match = await prisma.match.findUniqueOrThrow({
      where: { id: matchId },
      include: {
        homeTeam: { include: { members: { include: { participant: true } } } },
        awayTeam: { include: { members: { include: { participant: true } } } },
        events: { orderBy: { sequence: "asc" } },
        session: {
          include: {
            matches: {
              orderBy: { sequence: "asc" },
              include: { homeTeam: true, awayTeam: true },
            },
          },
        },
        result: true,
      },
    });
    return Response.json(match);
  } catch (e) {
    return failure(e);
  }
}
