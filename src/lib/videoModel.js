export const VIDEO_PROCESSING_STATUSES = Object.freeze([
  "uploaded",
  "analyzing",
  "ready",
  "failed",
]);

export const VIDEO_SENSITIVITY_STATUSES = Object.freeze([
  "pending",
  "processing",
  "safe",
  "flagged",
]);

export function isVideoReadyForPlayback(video) {
  return video?.processingStatus === "ready";
}

export function isVideoPublicCatalogSafe(video) {
  return (
    video?.processingStatus === "ready" && video?.sensitivityStatus === "safe"
  );
}
