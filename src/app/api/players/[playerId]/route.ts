import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/http";
import { playerSchema } from "@/lib/validation";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  try {
    const { playerId } = await params;
    const data = playerSchema.parse(await req.json());
    return Response.json(
      await prisma.player.update({ where: { id: playerId }, data }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  try {
    const { playerId } = await params;
    await prisma.player.update({
      where: { id: playerId },
      data: { active: false },
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    return failure(e);
  }
}
