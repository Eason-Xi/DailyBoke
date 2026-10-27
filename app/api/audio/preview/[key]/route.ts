import { privatePreviewResponse } from "@/lib/local-audio";
import { reviewAccessResponse } from "@/lib/review-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ key: string }> };

export async function GET(request: Request, context: Context) {
  const denied = reviewAccessResponse(request);
  if (denied) return denied;
  const { key } = await context.params;
  return privatePreviewResponse(request, key);
}

export const HEAD = GET;
