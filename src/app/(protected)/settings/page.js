"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Box, TablePagination } from "@mui/material";
import SiteChrome from "@/components/SiteChrome";
import { useAuth } from "@/context/AuthContext";
import { fetchOrgVideos, fetchOrgMembers, patchMemberOrgRole } from "@/lib/orgApi";

export default function SettingsPage() {
  const { token, user } = useAuth();
  const organizations = useMemo(
    () => (Array.isArray(user?.organizations) ? user.organizations : []),
    [user?.organizations]
  );

  const [orgChip, setOrgChip] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const [byOrgVideos, setByOrgVideos] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [modalOrg, setModalOrg] = useState(null);
  const [modalVideo, setModalVideo] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersErr, setMembersErr] = useState("");
  const [roleSaving, setRoleSaving] = useState(null);

  const loadAll = useCallback(async () => {
    if (!token || !organizations.length) {
      setByOrgVideos({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadErr("");
    try {
      const entries = await Promise.all(
        organizations.map(async (o) => {
          const { videos } = await fetchOrgVideos(token, o.id, { limit: 500 });
          return [o.id, { orgName: o.name, orgRole: o.orgRole, videos }];
        })
      );
      setByOrgVideos(Object.fromEntries(entries));
    } catch (e) {
      setLoadErr(e.message || "Could not load videos");
      setByOrgVideos({});
    } finally {
      setLoading(false);
    }
  }, [token, organizations]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const flatVideos = useMemo(() => {
    const out = [];
    for (const o of organizations) {
      const pack = byOrgVideos[o.id];
      if (!pack?.videos) continue;
      for (const v of pack.videos) {
        out.push({
          ...v,
          _orgId: o.id,
          _orgName: pack.orgName || o.name,
          _myOrgRole: pack.orgRole || o.orgRole,
        });
      }
    }
    return out;
  }, [organizations, byOrgVideos]);

  const filtered = useMemo(() => {
    let list = flatVideos;
    if (orgChip !== "all") {
      list = list.filter((v) => v._orgId === orgChip);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          (v.title || "").toLowerCase().includes(q) ||
          (v._orgName || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [flatVideos, orgChip, search]);

  useEffect(() => {
    setPage(0);
  }, [orgChip, search]);

  const paginatedVideos = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const openMembers = async (orgId, video) => {
    setModalOrg(orgId);
    setModalVideo(video);
    setMembers([]);
    setMembersErr("");
    if (!token) return;
    setMembersLoading(true);
    try {
      const m = await fetchOrgMembers(token, orgId);
      setMembers(m);
    } catch (e) {
      setMembersErr(e.message || "Could not load members");
    } finally {
      setMembersLoading(false);
    }
  };

  const closeModal = () => {
    setModalOrg(null);
    setModalVideo(null);
    setMembers([]);
    setMembersErr("");
  };

  const adminForModalOrg = organizations.find((o) => o.id === modalOrg)?.orgRole === "admin";

  const changeRole = async (memberUserId, orgRole) => {
    if (!token || !modalOrg || !adminForModalOrg) return;
    setRoleSaving(memberUserId);
    setMembersErr("");
    try {
      await patchMemberOrgRole(token, modalOrg, memberUserId, orgRole);
      setMembers((prev) =>
        prev.map((m) => (m.userId === memberUserId ? { ...m, orgRole } : m))
      );
    } catch (e) {
      setMembersErr(e.message || "Update failed");
    } finally {
      setRoleSaving(null);
    }
  };

  return (
    <SiteChrome title="Settings">
      <main className="org-panel">
        <label className="org-field" style={{ marginBottom: 12, maxWidth: 320 }}>
          Filter by title or org name
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
        </label>

        <div className="org-chips">
          <button
            type="button"
            className={`org-chip${orgChip === "all" ? " org-chip--active" : ""}`}
            onClick={() => setOrgChip("all")}
          >
            All organizations
          </button>
          {organizations.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`org-chip${orgChip === o.id ? " org-chip--active" : ""}`}
              onClick={() => setOrgChip(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="home-loading" aria-busy="true">
            <span className="auth-loading-dot" />
            <p>Loading videos…</p>
          </div>
        ) : null}
        {loadErr ? <p className="auth-error">{loadErr}</p> : null}

        {!loading && !loadErr && organizations.length === 0 ? (
          <p className="org-muted">
            No organizations.{" "}
            <Link href="/organization" className="auth-link">
              Create one
            </Link>
            .
          </p>
        ) : null}

        {!loading && !loadErr && filtered.length > 0 ? (
          <>
            <div className="org-settings-grid">
              {paginatedVideos.map((v) => (
                <article key={`${v._orgId}-${v.id}`} className="org-settings-card">
                  <div className="org-settings-thumb">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt="" />
                    ) : (
                      <span className="org-settings-thumb-letter">
                        {(v.title || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="org-settings-card-body">
                    <div className="org-settings-card-title">{v.title}</div>
                    <div className="org-badge">{v._orgName}</div>
                    {v._myOrgRole === "admin" ? (
                      <button
                        type="button"
                        className="org-btn org-btn-primary"
                        style={{ marginTop: 10, width: "100%" }}
                        onClick={() => void openMembers(v._orgId, v)}
                      >
                        Members &amp; roles
                      </button>
                    ) : (
                      <p className="org-muted" style={{ marginTop: 10, marginBottom: 0 }}>
                        View only — org admins manage members and roles.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(Number.parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[6, 12, 24, 48]}
                labelRowsPerPage="Rows per page"
              />
            </Box>
          </>
        ) : null}

        {!loading && !loadErr && organizations.length > 0 && filtered.length === 0 ? (
          <p className="org-muted">No videos match these filters.</p>
        ) : null}

        {modalOrg && modalVideo ? (
          <div
            className="org-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="org-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div className="org-modal">
              <div className="org-modal-header">
                <h2 id="org-modal-title" style={{ fontSize: "1rem", fontWeight: 700 }}>
                  Members — {organizations.find((o) => o.id === modalOrg)?.name || "Organization"}
                </h2>
                <button type="button" className="org-btn" onClick={closeModal}>
                  Close
                </button>
              </div>
              <div className="org-modal-body">
                <p className="org-muted" style={{ marginBottom: 12 }}>
                  Video: <strong>{modalVideo.title}</strong>
                </p>
                {!adminForModalOrg ? (
                  <p className="org-muted">
                    You are not an admin of this organization. Roles can only be changed by an org
                    admin.
                  </p>
                ) : null}
                {membersLoading ? <p className="org-muted">Loading members…</p> : null}
                {membersErr ? <p className="auth-error">{membersErr}</p> : null}
                {!membersLoading &&
                  members.map((m) => (
                    <div key={m.userId} className="org-member-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div className="org-muted">{m.email}</div>
                        {m.phone ? <div className="org-muted">{m.phone}</div> : null}
                      </div>
                      <div className="org-role-radios">
                        {["admin", "editor", "viewer"].map((r) => (
                          <label key={r}>
                            <input
                              type="radio"
                              name={`role-${m.userId}`}
                              checked={m.orgRole === r}
                              disabled={
                                !adminForModalOrg ||
                                roleSaving === m.userId ||
                                m.isOrganizationCreator
                              }
                              onChange={() => void changeRole(m.userId, r)}
                            />
                            {r}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </SiteChrome>
  );
}
