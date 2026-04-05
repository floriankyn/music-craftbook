import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const tags = await prisma.searchTag.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: { name: true },
  });

  return Response.json({ tags: tags.map((t) => t.name) });
}

// POST — create a tag { name }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { name } = await req.json() as { name: string };
  if (!name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  try {
    await prisma.searchTag.create({
      data: { userId: session.userId, name: name.trim() },
    });
  } catch {
    // unique constraint — tag already exists, treat as success
  }

  return Response.json({ ok: true });
}

// PATCH — rename a tag { from, to }
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { from, to } = await req.json() as { from: string; to: string };
  if (!from?.trim() || !to?.trim()) {
    return Response.json({ error: "from and to are required" }, { status: 400 });
  }

  await prisma.searchTag.updateMany({
    where: { userId: session.userId, name: from.trim() },
    data: { name: to.trim() },
  });

  return Response.json({ ok: true });
}

// DELETE — delete a tag { name }
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { name } = await req.json() as { name: string };
  if (!name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  await prisma.searchTag.deleteMany({
    where: { userId: session.userId, name: name.trim() },
  });

  return Response.json({ ok: true });
}
