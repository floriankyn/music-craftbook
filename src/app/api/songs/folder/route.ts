import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

// PATCH /api/songs/folder — rename a folder { from: string, to: string }
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { from, to } = body as { from: string; to: string };

  if (!from || typeof from !== "string" || !to || typeof to !== "string") {
    return Response.json({ error: "from and to are required strings" }, { status: 400 });
  }

  await prisma.note.updateMany({
    where: { userId: session.userId, folder: from },
    data: { folder: to.trim() },
  });

  return Response.json({ ok: true });
}

// DELETE /api/songs/folder — delete a folder (removes songs from it, keeps notes) { name: string }
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body as { name: string };

  if (!name || typeof name !== "string") {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  await prisma.note.updateMany({
    where: { userId: session.userId, folder: name },
    data: { folder: null },
  });

  return Response.json({ ok: true });
}
