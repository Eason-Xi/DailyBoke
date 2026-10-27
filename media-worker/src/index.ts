import { parseByteRange } from "../../lib/http-range";
import { isPublicMediaKey } from "./policy";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "Range, If-Range, If-None-Match",
  "access-control-expose-headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type, ETag",
  "x-content-type-options": "nosniff",
};

export default {
  async fetch(request, env): Promise<Response> {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405, headers: { ...corsHeaders, allow: "GET, HEAD, OPTIONS", "cache-control": "no-store" } });
    }
    const key = new URL(request.url).pathname.slice(1);
    if (!isPublicMediaKey(key)) return new Response("Not found", { status: 404, headers: { ...corsHeaders, "cache-control": "no-store" } });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, "access-control-max-age": "3600" } });
    try {
      const metadata = await env.AUDIO.head(key);
      if (!metadata) return new Response("Not found", { status: 404, headers: { ...corsHeaders, "cache-control": "no-store" } });
      const mime = key.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
      const headers = new Headers({
        ...corsHeaders,
        "content-type": mime,
        "content-length": String(metadata.size),
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=31536000, immutable",
        etag: metadata.httpEtag,
        "last-modified": metadata.uploaded.toUTCString(),
      });
      const etags = request.headers.get("if-none-match")?.split(",").map(value => value.trim().replace(/^W\//, ""));
      if (etags?.includes(metadata.httpEtag) || etags?.includes("*")) {
        headers.delete("content-length");
        return new Response(null, { status: 304, headers });
      }
      if (request.method === "HEAD") return new Response(null, { headers });
      const ifRange = request.headers.get("if-range");
      const rangeHeader = !ifRange || ifRange === metadata.httpEtag || ifRange === metadata.uploaded.toUTCString() ? request.headers.get("range") : null;
      const range = parseByteRange(rangeHeader, metadata.size);
      if (range === "invalid") {
        headers.set("content-range", `bytes */${metadata.size}`);
        headers.set("content-length", "0");
        return new Response(null, { status: 416, headers });
      }
      const object = await env.AUDIO.get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
      if (!object) return new Response("Not found", { status: 404, headers: { ...corsHeaders, "cache-control": "no-store" } });
      if (range) {
        headers.set("content-range", `bytes ${range.start}-${range.end}/${metadata.size}`);
        headers.set("content-length", String(range.end - range.start + 1));
      }
      return new Response(object.body, { status: range ? 206 : 200, headers });
    } catch {
      console.error(JSON.stringify({ event: "media_read_failed" }));
      return new Response("Media temporarily unavailable", { status: 503, headers: { ...corsHeaders, "cache-control": "no-store" } });
    }
  },
} satisfies ExportedHandler<Env>;
