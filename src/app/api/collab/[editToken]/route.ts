import { type NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

type Ctx = { params: Promise<{ editToken: string }> };

// GET /api/collab/[editToken] — load a note as a collaborator
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { editToken } = await params;

  const note = await prisma.note.findUnique({
    where: { editToken },
    include: {
      user: { select: { email: true } },
    },
  });

  if (!note) return Response.json({ error: "Not found" }, { status: 404 });

  // Also try to load the owner's favorite for this beat (for beat metadata / thumbnail)
  const favorite = await prisma.favorite.findUnique({
    where: { userId_videoId: { userId: note.userId, videoId: note.videoId } },
  });

  return Response.json({ note, favorite, ownerEmail: note.user.email });
}
