import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const notes = await prisma.note.findMany({
    where: {
      userId: session.userId,
      songName: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      videoId: true,
      songName: true,
      folder: true,
      isPublic: true,
      publicId: true,
      bpm: true,
      key: true,
      beatType: true,
      videoTitle: true,
      videoThumbnail: true,
      updatedAt: true,
    },
  });

  return Response.json({ songs: notes });
}

// PATCH /api/songs — move a song to a folder (or null to remove from folder)
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { videoId, folder } = body as { videoId: string; folder: string | null };

  if (!videoId || typeof videoId !== "string") {
    return Response.json({ error: "videoId required" }, { status: 400 });
  }
  if (folder !== null && typeof folder !== "string") {
    return Response.json({ error: "folder must be a string or null" }, { status: 400 });
  }

  await prisma.note.updateMany({
    where: { userId: session.userId, videoId },
    data: { folder: folder?.trim() || null },
  });

  return Response.json({ ok: true });
}
