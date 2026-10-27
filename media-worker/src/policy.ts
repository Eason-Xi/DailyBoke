/** Uploader writes here only as part of an explicit approved publication/migration. */
export function isPublicMediaKey(key: string) {
  return /^published\/episodes\/[a-zA-Z0-9_-]+\/[a-f0-9]{64}\.(wav|mp3)$/.test(key);
}
