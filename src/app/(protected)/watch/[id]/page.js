"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  fetchPublicVideoMeta,
  fetchOrgMemberVideoWatchMeta,
  getVideoQualitySources,
} from "@/lib/videosApi";
import UserAvatarMenu from "@/components/UserAvatarMenu";
import { useAuth } from "@/context/AuthContext";

export default function WatchPage() {
  const router = useRouter();
  const { id } = useParams();
  const { token } = useAuth();
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  const [video, setVideo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);

  const qualitySources = video ? getVideoQualitySources(video) : [];
  const playbackUrl = qualitySources[0]?.src || "";

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    setLoadError("");
    setVideo(null);
    (async () => {
      try {
        let v = null;
        if (token) {
          try {
            v = await fetchOrgMemberVideoWatchMeta(token, id);
          } catch {}
        }
        if (!v) {
          v = await fetchPublicVideoMeta(id);
        }
        if (!cancelled) setVideo(v);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || "Not found");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  useEffect(() => {
    if (!video || !playbackUrl || !videoRef.current) return;

    if (!document.getElementById("plyr-css")) {
      const link = document.createElement("link");
      link.id = "plyr-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.plyr.io/3.8.4/plyr.css";
      document.head.appendChild(link);
    }

    const el = videoRef.current;
    const sources = getVideoQualitySources(video);
    const enableQuality = sources.length > 1;
    const qualitySizes = [...new Set(sources.map((s) => s.size))].sort((a, b) => b - a);

    const initPlayer = async () => {
      const Plyr = (await import("plyr")).default;
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      playerRef.current = new Plyr(el, {
        controls: [
          "play-large",
          "play",
          "rewind",
          "fast-forward",
          "progress",
          "current-time",
          "duration",
          "mute",
          "volume",
          "settings",
          "fullscreen",
        ],
        settings: enableQuality ? ["quality", "speed", "loop"] : ["speed", "loop"],
        ...(enableQuality
          ? {
              quality: {
                forced: true,
                default: qualitySizes[0],
                options: qualitySizes,
                onChange: (q) => {
                  const entry = sources.find((s) => s.size === q);
                  if (!entry) return;
                  const cur = el.currentTime;
                  const paused = el.paused;
                  const rate = el.playbackRate;
                  el.src = entry.src;
                  el.load();
                  const onMeta = () => {
                    el.playbackRate = rate;
                    try {
                      el.currentTime = cur;
                    } catch {}
                    if (!paused) void el.play();
                  };
                  el.addEventListener("loadedmetadata", onMeta, { once: true });
                },
              },
            }
          : {}),
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        tooltips: { controls: true, seek: true },
        keyboard: { focused: true, global: false },
        disableContextMenu: false,
      });

      el.load();

      el.addEventListener(
        "loadedmetadata",
        () => {
          playerRef.current?.play().catch(() => {});
        },
        { once: true }
      );
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [video, playbackUrl, id]);

  if (metaLoading) {
    return (
      <div className="page-wrapper player-page">
        <header className="site-header site-header--elevated">
          <div className="site-header-inner">
            <div className="header-left">
              <Link href="/" className="logo">
                <div className="logo-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="logo-text">
                  Stream<span>Hub</span>
                </span>
              </Link>
            </div>
            <div className="header-center">
              <div className="watch-header-spacer" aria-hidden />
            </div>
            <div className="header-right">
              <UserAvatarMenu />
            </div>
          </div>
        </header>
        <div className="home-loading" style={{ flex: 1 }}>
          <span className="auth-loading-dot" />
        </div>
      </div>
    );
  }

  if (loadError || !video) {
    return (
      <div className="page-wrapper" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="empty-state">
          <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.07A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.892L15 14M4 8a2 2 0 00-2 2v4a2 2 0 002 2h8a2 2 0 002-2v-4a2 2 0 00-2-2H4z"
            />
          </svg>
          <p>Video not found or still processing.</p>
          <button type="button" className="clear-link" onClick={() => router.push("/")}>
            Go back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper player-page">
      <header className="site-header site-header--elevated">
        <div className="site-header-inner">
          <div className="header-left">
            <Link href="/" className="logo">
              <div className="logo-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span className="logo-text">
                Stream<span>Hub</span>
              </span>
            </Link>
          </div>
          <div className="header-center">
            <div className="watch-header-spacer" aria-hidden />
          </div>
          <div className="header-right">
            <UserAvatarMenu />
          </div>
        </div>
      </header>

      <main className="player-main watch-main">
        <h1 className="watch-title">{video.title}</h1>

        <div className="watch-player-shell">
          <div className="plyr-wrapper plyr-wrapper--watch">
            <video
              key={id}
              ref={videoRef}
              className="plyr-react plyr"
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
            >
              {qualitySources.map((s) => (
                <source key={s.src} src={s.src} type={s.type} size={s.size} />
              ))}
            </video>
          </div>
        </div>
      </main>
    </div>
  );
}
