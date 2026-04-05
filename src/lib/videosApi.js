export function getApiBase() {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
    "http://localhost:8000/api"
  );
}

export function getApiOrigin() {
  return getApiBase().replace(/\/api\/?$/, "");
}

export function apiVideosPath(path) {
  const base = getApiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function getVideoPlaybackUrl(video) {
  if (!video) return "";
  if (video.playbackUrl) return video.playbackUrl;
  if (video.id) return `${getApiOrigin()}/api/videos/${video.id}/stream`;
  return "";
}

export function getVideoQualitySources(video) {
  const url = getVideoPlaybackUrl(video);
  const mime = video?.mimeType || "video/mp4";
  if (!url) return [];

  const lower = url.toLowerCase();
  const marker = "/video/upload/";
  const i = lower.indexOf(marker);
  if (!lower.includes("res.cloudinary.com") || i === -1) {
    return [{ src: url, type: mime, size: 1080 }];
  }

  const prefix = url.slice(0, i + marker.length);
  const suffix = url.slice(i + marker.length);
  const best = { src: url, type: mime, size: 1080 };
  const transforms = [
    { t: "w_1280,c_limit,q_auto,f_auto/", size: 720 },
    { t: "w_854,c_limit,q_auto,f_auto/", size: 480 },
    { t: "w_640,c_limit,q_auto,f_auto/", size: 360 },
  ];
  const variants = transforms.map(({ t, size }) => ({
    src: `${prefix}${t}${suffix}`,
    type: mime,
    size,
  }));

  return [best, ...variants];
}

export async function fetchPublicVideos(params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.dateFrom) q.set("dateFrom", params.dateFrom);
  if (params.dateTo) q.set("dateTo", params.dateTo);
  if (params.minSize != null) q.set("minSize", String(params.minSize));
  if (params.maxSize != null) q.set("maxSize", String(params.maxSize));
  if (params.minDuration != null) q.set("minDuration", String(params.minDuration));
  if (params.maxDuration != null) q.set("maxDuration", String(params.maxDuration));
  const url = `${apiVideosPath("/videos")}${q.toString() ? `?${q}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Failed to load videos");
  }
  return data.videos || [];
}

export async function fetchPublicVideoMeta(id) {
  const res = await fetch(apiVideosPath(`/videos/${id}`), { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Not found");
  }
  return data.video;
}

export async function fetchOrgMemberVideoWatchMeta(token, videoId) {
  const base = getApiBase().replace(/\/$/, "");
  const res = await fetch(`${base}/users/me/videos/${videoId}/watch-meta`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Not found");
  }
  return data.video;
}
