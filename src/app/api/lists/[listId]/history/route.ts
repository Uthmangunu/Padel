import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/http";
import { clearHistorySchema } from "@/lib/validation";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    clearHistorySchema.parse(await req.json());
    const removed = await prisma.session.deleteMany({
      where: { listId, status: { in: ["COMPLETE", "CANCELLED"] } },
    });
    return Response.json({ removed: removed.count });
  } catch (error) {
    return failure(error);
  }
}
