import { NextResponse } from "next/server";
import { getEpisodes, getPublishedEpisodes } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeAll = url.searchParams.get("all") === "1";
  return NextResponse.json({ episodes: includeAll ? await getEpisodes() : await getPublishedEpisodes() });
}
