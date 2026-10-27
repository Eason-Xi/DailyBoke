import { NextResponse, type NextRequest } from "next/server";
import { reviewAccessResponse } from "./lib/review-access";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/episodes" && request.nextUrl.searchParams.get("all") !== "1") return NextResponse.next();
  const denied = reviewAccessResponse(request);
  if (denied) return denied;
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

export const config = { matcher: ["/review/:path*", "/api/review/:path*", "/api/audio/preview/:path*", "/api/episodes"] };
