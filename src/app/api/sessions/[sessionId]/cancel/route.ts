import { prisma } from "@/lib/prisma";
import { failure, AppError } from "@/lib/http";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const session = await prisma.$transaction(async (tx) => {
      const current = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: { matches: true },
      });
      if (current.status !== "ACTIVE")
        throw new AppError(400, "Only an active session can be stopped");
      await tx.match.updateMany({
        where: {
          sessionId,
          status: { in: ["LIVE", "AWAITING_CONFIRMATION", "PENDING"] },
        },
        data: { status: "CANCELLED", endedAt: new Date() },
      });
      return tx.session.update({
        where: { id: sessionId },
        data: { status: "CANCELLED", completedAt: new Date() },
        include: { matches: true },
      });
    });
    return Response.json(session);
  } catch (error) {
    return failure(error);
  }
}
