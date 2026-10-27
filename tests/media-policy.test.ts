import { describe, expect, it } from "vitest";
import { isPublicMediaKey } from "../media-worker/src/policy";
import { parseByteRange } from "../lib/http-range";

describe("public read-only media gateway policy", () => {
  it("allows only explicit published audio keys, never previews or arbitrary bucket paths", () => {
    const hash = "a".repeat(64);
    expect(isPublicMediaKey(`published/episodes/episode-test/${hash}.wav`)).toBe(true);
    for (const key of [`private/preview/${hash}.wav`, `episodes/episode-test/${hash}.wav`, "", "published/../secret", `published/episodes/episode-test/${hash}.json`, `published/episodes/episode-test/${hash}.wav/extra`]) expect(isPublicMediaKey(key)).toBe(false);
  });
  it("handles seek, suffix and open-ended ranges and rejects multipart or unsafe ranges", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
    for (const range of ["bytes=100-", "bytes=10-1", "bytes=-0", "bytes=0-1,10-20", "bytes=999999999999999999999-"]) expect(parseByteRange(range, 100)).toBe("invalid");
  });
});
