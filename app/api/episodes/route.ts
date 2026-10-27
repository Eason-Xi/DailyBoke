import { NextResponse } from "next/server";
import { getEpisodes, getPublishedEpisodes } from "@/lib/content-store";
import { reviewAccessResponse } from "@/lib/review-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeAll = url.searchParams.get("all") === "1";
  if (includeAll) {
    const denied = reviewAccessResponse(request);
    if (denied) return denied;
  }
  return NextResponse.json({ episodes: includeAll ? await getEpisodes() : await getPublishedEpisodes() });
}
