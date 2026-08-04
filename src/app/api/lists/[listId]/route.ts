import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/http";
import { listSchema } from "@/lib/validation";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    return Response.json(
      await prisma.list.update({
        where: { id: listId },
        data: listSchema.parse(await req.json()),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    await prisma.list.update({
      where: { id: listId },
      data: { active: false },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
