import { type NextRequest } from "next/server";
import {
  execFileAsync,
  getYtDlpPath,
  analyzeBeatInfo,
} from "@/app/lib/ytdlp";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";

export const maxDuration = 60;

function computeDateAfter(filter: string): string {
  const d = new Date();
  switch (filter) {
    case "year":    d.setFullYear(d.getFullYear() - 1); break;
    case "6months": d.setMonth(d.getMonth() - 6); break;
    case "1month":  d.setMonth(d.getMonth() - 1); break;
    case "2weeks":  d.setDate(d.getDate() - 14); break;
    case "1week":   d.setDate(d.getDate() - 7); break;
    case "1day":    d.setDate(d.getDate() - 1); break;
  }
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

const PAGE_SIZE = 15;
const MAX_PAGE = 4;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q");
  const dateFilter = request.nextUrl.searchParams.get("dateFilter");
  const page = Math.min(MAX_PAGE, Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10)));

  if (!query || !query.trim()) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }

  const ytdlp = getYtDlpPath();
  const fetchCount = page * PAGE_SIZE;

  const args = [
    `ytsearch${fetchCount}:${query.trim()}`,
    "--dump-json",
    "--no-download",
    "--no-playlist",
    "--no-warnings",
  ];

  if (dateFilter) {
    args.push("--dateafter", computeDateAfter(dateFilter));
  }

  try {
    const { stdout } = await execFileAsync(ytdlp, args, {
      timeout: 45000,
      maxBuffer: 50 * 1024 * 1024,
    });

    const lines = stdout.trim().split("\n").filter(Boolean);

    const allResults = lines.map((line) => {
      const data = JSON.parse(line);
      const id = data.id || "";
      const title = data.title || "Untitled";
      const description = data.description || "";
      const duration = data.duration || 0;
      const thumbnail =
        data.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      const analysis = analyzeBeatInfo(title, description, "");

      return {
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        duration: formatDuration(Math.round(duration)),
        durationSec: Math.round(duration),
        thumbnail,
        viewCount: typeof data.view_count === "number" ? data.view_count : null,
        uploader: data.uploader || data.channel || null,
        uploadDate: data.upload_date || null,
        ...analysis,
      };
    });

    // Return only the new page slice
    const pageResults = allResults.slice((page - 1) * PAGE_SIZE);
    const hasMore = page < MAX_PAGE && lines.length >= fetchCount;

    // Persist all seen videos to the cache (fire-and-forget)
    void Promise.all(
      allResults
        .filter((r) => r.id)
        .map((r) =>
          prisma.cachedVideo.upsert({
            where: { videoId: r.id },
            update: {
              title: r.title,
              thumbnail: r.thumbnail,
              duration: r.duration,
              durationSec: r.durationSec,
              url: r.url,
              viewCount: r.viewCount ?? null,
              uploader: r.uploader ?? null,
              uploadDate: r.uploadDate ?? null,
            },
            create: {
              videoId: r.id,
              title: r.title,
              thumbnail: r.thumbnail,
              duration: r.duration,
              durationSec: r.durationSec,
              url: r.url,
              viewCount: r.viewCount ?? null,
              uploader: r.uploader ?? null,
              uploadDate: r.uploadDate ?? null,
            },
          })
        )
    );

    return Response.json({ results: pageResults, page, hasMore });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
