import { type NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

type Ctx = { params: Promise<{ videoId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { videoId } = await params;

  const [favorite, note] = await Promise.all([
    prisma.favorite.findUnique({
      where: { userId_videoId: { userId: session.userId, videoId } },
    }),
    prisma.note.findUnique({
      where: { userId_videoId: { userId: session.userId, videoId } },
    }),
  ]);

  if (!favorite) {
    return Response.json({ error: "Favorite not found" }, { status: 404 });
  }

  return Response.json({ favorite, note });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { videoId } = await params;
  const { blocks } = await request.json();

  const note = await prisma.note.upsert({
    where: { userId_videoId: { userId: session.userId, videoId } },
    create: { userId: session.userId, videoId, blocks },
    update: { blocks },
  });

  return Response.json({ note });
}
