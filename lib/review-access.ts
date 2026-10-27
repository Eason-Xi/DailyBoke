import { createHash, timingSafeEqual } from "node:crypto";

/** Local development stays usable; externally hosted review/preview routes fail closed. */
export function reviewAccessResponse(request: Request): Response | null {
  const token = process.env.REVIEW_ACCESS_TOKEN?.trim();
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response("Forbidden", { status: 403 });
  if (!token) {
    const hostname = new URL(request.url).hostname;
    if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return null;
    return new Response("请在服务端配置 REVIEW_ACCESS_TOKEN 后访问审核后台。", { status: 503, headers: { "cache-control": "private, no-store" } });
  }
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Basic ${Buffer.from(`review:${token}`).toString("base64")}`;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (timingSafeEqual(hash(supplied), hash(expected))) return null;
  return new Response("请使用审核账号登录。", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="DailyBoke review", charset="UTF-8"', "cache-control": "private, no-store" },
  });
}
