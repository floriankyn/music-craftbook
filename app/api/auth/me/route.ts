import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ user: null });
  }
  return Response.json({ user: { id: session.userId } });
}
