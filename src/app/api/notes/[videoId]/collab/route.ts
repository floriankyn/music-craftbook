import { type NextRequest } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

type Ctx = { params: Promise<{ videoId: string }> };

// POST /api/notes/[videoId]/collab — generate (or return existing) editToken
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { videoId } = await params;

  const note = await prisma.note.findUnique({
    where: { userId_videoId: { userId: session.userId, videoId } },
    select: { editToken: true },
  });

  // If note doesn't exist yet, create a minimal one so the token has a home
  if (!note) {
    const created = await prisma.note.create({
      data: {
        userId: session.userId,
        videoId,
        editToken: crypto.randomUUID(),
      },
    });
    return Response.json({ editToken: created.editToken });
  }

  if (note.editToken) {
    return Response.json({ editToken: note.editToken });
  }

  const updated = await prisma.note.update({
    where: { userId_videoId: { userId: session.userId, videoId } },
    data: { editToken: crypto.randomUUID() },
    select: { editToken: true },
  });

  return Response.json({ editToken: updated.editToken });
}

// DELETE /api/notes/[videoId]/collab — revoke editToken
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { videoId } = await params;

  await prisma.note.updateMany({
    where: { userId: session.userId, videoId },
    data: { editToken: null },
  });

  return Response.json({ ok: true });
}
