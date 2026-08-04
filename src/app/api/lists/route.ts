import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/http";
import { listSchema } from "@/lib/validation";
export async function GET() {
  try {
    return Response.json(
      await prisma.list.findMany({
        where: { active: true },
        include: {
          _count: {
            select: { players: { where: { active: true } }, sessions: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const data = listSchema.parse(await req.json());
    return Response.json(await prisma.list.create({ data }), { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
