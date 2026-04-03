import { type NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

function getYtDlpPath(): string {
  const bundled = join(process.cwd(), "bin", "yt-dlp_linux");
  if (process.platform === "linux" && existsSync(bundled)) {
    return bundled;
  }
  return "yt-dlp";
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  if (
    !url.match(
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/
    )
  ) {
    return Response.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const ytdlp = getYtDlpPath();

  try {
    // Fetch title and description
    const { stdout: meta } = await execFileAsync(
      ytdlp,
      [
        "--print", "%(title)s\n---SPLIT---\n%(description)s",
        "--no-playlist",
        "--no-warnings",
        url,
      ],
      { timeout: 20000 }
    );

    const [title, ...descParts] = meta.split("---SPLIT---");
    const description = descParts.join("---SPLIT---").trim();

    // Fetch top comments (may fail if comments are disabled)
    let comments = "";
    try {
      const { stdout: commentsRaw } = await execFileAsync(
        ytdlp,
        [
          "--write-comments",
          "--extractor-args", "youtube:max_comments=30",
          "--print", "%(comments.:.text)j",
          "--no-download",
          "--no-playlist",
          "--no-warnings",
          url,
        ],
        { timeout: 30000 }
      );
      // Parse the JSON array of comment texts
      try {
        const parsed = JSON.parse(commentsRaw.trim());
        if (Array.isArray(parsed)) {
          comments = parsed.slice(0, 30).join("\n");
        }
      } catch {
        comments = commentsRaw.trim().slice(0, 3000);
      }
    } catch {
      // Comments might be disabled or unavailable
    }

    // Analyze the metadata to extract beat info
    const analysis = analyzeBeatInfo(title.trim(), description, comments);

    return Response.json(analysis);
  } catch {
    return Response.json(
      { error: "Failed to analyze video" },
      { status: 500 }
    );
  }
}

interface BeatAnalysis {
  title: string;
  bpm: string | null;
  key: string | null;
  beatType: string | null;
  inspiredBy: string[];
  tags: string[];
}

function analyzeBeatInfo(
  title: string,
  description: string,
  comments: string
): BeatAnalysis {
  const all = `${title}\n${description}\n${comments}`;
  const allLower = all.toLowerCase();

  // Extract BPM
  let bpm: string | null = null;
  const bpmPatterns = [
    /(\d{2,3})\s*bpm/i,
    /bpm\s*[:\-–]?\s*(\d{2,3})/i,
    /tempo\s*[:\-–]?\s*(\d{2,3})/i,
  ];
  for (const pat of bpmPatterns) {
    const m = all.match(pat);
    if (m) {
      const val = parseInt(m[1]);
      if (val >= 40 && val <= 300) {
        bpm = `${val} BPM`;
        break;
      }
    }
  }

  // Extract key
  let key: string | null = null;
  const keyPatterns = [
    /\b([A-G][#b]?\s*(?:major|minor|maj|min))\b/i,
    /key\s*(?:of\s+)?[:\-–]?\s*([A-G][#b]?\s*(?:major|minor|maj|min)?(?:\s*m)?)\b/i,
    /\b([A-G][#b]?m(?:aj|in)?(?:or)?)\b/i,
  ];
  for (const pat of keyPatterns) {
    const m = all.match(pat);
    if (m) {
      key = m[1].trim();
      break;
    }
  }

  // Extract beat type from title/description
  let beatType: string | null = null;
  const beatTypes = [
    "trap", "drill", "uk drill", "ny drill", "boom bap", "lo-fi", "lofi",
    "r&b", "rnb", "soul", "jazz", "afrobeat", "afro", "reggaeton",
    "dancehall", "pop", "rock", "dark", "melodic", "hard", "aggressive",
    "chill", "ambient", "plugg", "rage", "hyperpop", "jersey club",
    "phonk", "memphis", "west coast", "east coast", "southern",
    "type beat", "guitar", "piano", "flute", "orchestral", "cinematic",
    "emotional", "sad", "hype", "bouncy", "smooth",
  ];
  const foundTypes: string[] = [];
  for (const bt of beatTypes) {
    if (allLower.includes(bt)) {
      foundTypes.push(bt);
    }
  }
  if (foundTypes.length > 0) {
    // Filter out "type beat" if other types found
    const meaningful = foundTypes.filter((t) => t !== "type beat");
    beatType = (meaningful.length > 0 ? meaningful : foundTypes)
      .slice(0, 3)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(" / ");
  }

  // Extract artist references — look for "X type beat" pattern and other mentions
  const inspiredBy: string[] = [];
  const typePatterns = [
    /([A-Z][a-zA-Z0-9$. ]+?)\s+type\s+beat/gi,
    /type\s+(?:beat\s+)?[–\-]\s*([A-Z][a-zA-Z0-9$. ]+)/gi,
    /inspired\s+by\s+([A-Z][a-zA-Z0-9$., &]+)/gi,
    /style\s*(?:of|:)\s*([A-Z][a-zA-Z0-9$., &]+)/gi,
  ];
  const seen = new Set<string>();
  for (const pat of typePatterns) {
    let m;
    while ((m = pat.exec(all)) !== null) {
      const names = m[1]
        .split(/[,&x×]/)
        .map((n) => n.trim())
        .filter((n) => n.length > 1 && n.length < 40);
      for (const name of names) {
        const lower = name.toLowerCase();
        // Filter out generic words
        if (
          !seen.has(lower) &&
          !["free", "hard", "dark", "sad", "chill", "type", "beat", "prod", "2024", "2025", "2026"].includes(lower)
        ) {
          seen.add(lower);
          inspiredBy.push(name);
        }
      }
    }
  }

  // Extract tags from common bracket/hashtag patterns
  const tags: string[] = [];
  const tagMatches = all.match(/#(\w+)/g);
  if (tagMatches) {
    for (const tag of tagMatches.slice(0, 8)) {
      tags.push(tag);
    }
  }

  return {
    title,
    bpm,
    key,
    beatType,
    inspiredBy: inspiredBy.slice(0, 5),
    tags: tags.slice(0, 6),
  };
}
