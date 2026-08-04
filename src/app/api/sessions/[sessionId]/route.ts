import { prisma } from "@/lib/prisma";
import { failure, AppError } from "@/lib/http";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: { status: true },
    });
    if (session.status === "ACTIVE")
      throw new AppError(400, "Stop live scoring before deleting a session");
    await prisma.session.delete({ where: { id: sessionId } });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
