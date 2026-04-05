"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Chip, Stack, TablePagination } from "@mui/material";
import { useAuth } from "@/context/AuthContext";
import { fetchOrgVideos } from "@/lib/orgApi";
import { isVideoReadyForPlayback } from "@/lib/videoModel";
import { organizationsForChips } from "@/lib/organizationsForChips";
import { useStableOrganizations } from "@/lib/useStableOrganizations";
import UserAvatarMenu from "@/components/UserAvatarMenu";

function VideoCard({ video, orgName }) {
  const initial = (video.title || "?").charAt(0).toUpperCase();
  const canWatch = isVideoReadyForPlayback(video);

  const body = (
    <>
      <div className="card-thumb card-thumb--placeholder" aria-hidden>
        <span className="card-thumb-letter">{initial}</span>
      </div>
      <div className="card-title-wrap">
        <h2 className="card-title">{video.title}</h2>
        {orgName ? (
          <p className="card-org-label" style={{ margin: "6px 0 0", fontSize: "0.85rem", opacity: 0.75 }}>
            {orgName}
          </p>
        ) : null}
        {!canWatch ? (
          <p className="card-org-label" style={{ margin: "4px 0 0", fontSize: "0.8rem", opacity: 0.6 }}>
            {video.processingStatus}
          </p>
        ) : null}
      </div>
    </>
  );

  if (canWatch) {
    return (
      <Link href={`/watch/${video.id}`} className="video-card">
        {body}
      </Link>
    );
  }

  return (
    <div className="video-card" style={{ opacity: 0.75, cursor: "default" }} aria-disabled>
      {body}
    </div>
  );
}

export default function HomePage() {
  const { token, user, setActiveOrganizationId } = useAuth();
  const organizations = useStableOrganizations(user?.organizations);
  const chipOrganizations = useMemo(
    () => organizationsForChips(organizations, user?.activeOrganizationId),
    [organizations, user?.activeOrganizationId]
  );

  const orgId = useMemo(() => {
    const active = user?.activeOrganizationId;
    if (
      active &&
      chipOrganizations.some((o) => String(o.id) === String(active))
    ) {
      return active;
    }
    return chipOrganizations[0]?.id ?? null;
  }, [user?.activeOrganizationId, chipOrganizations]);

  const activeOrgName = useMemo(() => {
    if (!orgId) return "";
    return chipOrganizations.find((o) => String(o.id) === String(orgId))?.name ?? "";
  }, [orgId, chipOrganizations]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [videos, setVideos] = useState([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const listLoadInFlightRef = useRef(false);

  useEffect(() => {
    if (!token || !orgId) {
      setVideos([]);
      setVideoTotal(0);
      setListLoading(false);
      setListError("");
      return undefined;
    }

    const t = setTimeout(() => {
      void (async () => {
        if (listLoadInFlightRef.current) return;
        listLoadInFlightRef.current = true;
        setListLoading(true);
        setListError("");
        try {
          const skip = page * rowsPerPage;
          const { videos: list, total } = await fetchOrgVideos(
            token,
            orgId,
            {
              q: search.trim() || undefined,
              limit: rowsPerPage,
              skip,
            }
          );
          setVideos(list);
          setVideoTotal(total);
        } catch (e) {
          setListError(e.message || "Could not load videos");
          setVideos([]);
          setVideoTotal(0);
        } finally {
          listLoadInFlightRef.current = false;
          setListLoading(false);
        }
      })();
    }, search ? 350 : 0);

    return () => {
      clearTimeout(t);
    };
  }, [token, orgId, search, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [orgId]);

  useEffect(() => {
    if (videoTotal <= 0) return;
    const maxPage = Math.max(0, Math.ceil(videoTotal / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [videoTotal, rowsPerPage, page]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(0);
  };

  if (!organizations.length) {
    return (
      <div className="page-wrapper">
        <header className="site-header site-header--elevated site-header--simple">
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
            <div className="header-right">
              <UserAvatarMenu />
            </div>
          </div>
        </header>
        <main className="main-content main-content--home">
          <div className="empty-state">
            <p>Join an organization to see your videos here.</p>
            <Link href="/organization" className="auth-link">
              Organization setup
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
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
            <div className="search-bar">
              <span className="search-icon" aria-hidden>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search your org videos"
                aria-label="Search videos"
              />
              {search ? (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={() => handleSearch("")}
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <div className="header-right">
            <UserAvatarMenu />
          </div>
        </div>
      </header>

      <main className="main-content main-content--home">
        {chipOrganizations.length > 0 ? (
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            sx={{ mb: 2, px: 1, columnGap: 1, rowGap: 1.25 }}
          >
           
            {chipOrganizations.map((o) => {
              const selected = String(orgId) === String(o.id);
              return (
                <Chip
                  key={o.id}
                  label={o.name}
                  onClick={() => setActiveOrganizationId(o.id)}
                  color={selected ? "error" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  clickable
                  sx={{ fontWeight: selected ? 600 : 400 }}
                />
              );
            })}
          
          </Stack>
        ) : null}

        {listLoading ? (
          <div className="home-loading" aria-busy="true">
            <span className="auth-loading-dot" />
            <p>Loading videos…</p>
          </div>
        ) : null}

        {listError && !listLoading ? (
          <div className="empty-state">
            <p>{listError}</p>
            <p className="home-hint">Check NEXT_PUBLIC_API_URL and that you are signed in.</p>
          </div>
        ) : null}

        {!listLoading && !listError && videos.length > 0 ? (
          <div className="cards-grid">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} orgName={activeOrgName} />
            ))}
          </div>
        ) : null}

        {!listLoading && !listError && videos.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 10l4.553-2.07A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.892L15 14M4 8a2 2 0 00-2 2v4a2 2 0 002 2h8a2 2 0 002-2v-4a2 2 0 00-2-2H4z"
              />
            </svg>
            <p>No videos yet{search ? ` matching “${search}”` : ""} in this organization.</p>
            <p style={{ marginTop: "0.5rem" }}>
              <Link href="/videos" className="auth-link">
                Go to Videos to upload
              </Link>
            </p>
            {search ? (
              <button type="button" className="clear-link" onClick={() => handleSearch("")}>
                Clear search
              </button>
            ) : null}
          </div>
        ) : null}

        {!listLoading && !listError && videoTotal > 0 ? (
          <TablePagination
            component="div"
          
            count={videoTotal}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number.parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage="Rows per page"
          />
        ) : null}
      </main>
    </div>
  );
}
