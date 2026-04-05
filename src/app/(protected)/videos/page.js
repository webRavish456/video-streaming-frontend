"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import Link from "next/link";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Chip,
  TablePagination,
  TextField,
  Typography,
  LinearProgress,
} from "@mui/material";
import SiteChrome from "@/components/SiteChrome";
import { useAuth } from "@/context/AuthContext";
import {
  deleteOrgVideo,
  fetchOrgVideos,
  patchOrgVideo,
  replaceOrgVideo,
  uploadOrgVideo,
} from "@/lib/orgApi";
import { dialogCancelButtonSx, dialogPrimaryButtonSx } from "@/lib/dialogButtonSx";
import { getApiOrigin } from "@/lib/videosApi";
import { organizationsForChips } from "@/lib/organizationsForChips";
import { useStableOrganizations } from "@/lib/useStableOrganizations";

const MERGE_FETCH_LIMIT = 2000;

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function orgNameForVideo(v, organizations) {
  if (v.organization?.name) return v.organization.name;
  const id = v.organizationId;
  if (!id) return "—";
  return organizations.find((o) => String(o.id) === String(id))?.name ?? "—";
}

function orgIdForVideo(v) {
  if (v.organization?.id) return String(v.organization.id);
  if (v.organizationId) return String(v.organizationId);
  return "";
}

function orgRoleForVideo(v, organizations) {
  const oid = orgIdForVideo(v);
  if (!oid) return null;
  return organizations.find((o) => String(o.id) === oid)?.orgRole ?? null;
}

function canEditOrgVideo(v, organizations) {
  const r = orgRoleForVideo(v, organizations);
  return r === "admin" || r === "editor";
}

function canDeleteOrgVideo(v, organizations) {
  return orgRoleForVideo(v, organizations) === "admin";
}

function pipelineStatusLine(row) {
  if (!row) return "";
  if (row.phase === "uploading") {
    return `Uploading… ${row.uploadPercent ?? 0}%`;
  }
  if (row.phase === "upload_complete") {
    return "Upload complete · starting processing…";
  }
  if (row.phase === "processing") {
    const p = row.processingPercent ?? 0;
    const st = row.processingStatus ? ` · ${row.processingStatus}` : "";
    return `Processing… ${p}%${st}`;
  }
  if (row.phase === "completed") {
    if (row.sensitivityStatus === "flagged") return "❌ Flagged";
    if (row.sensitivityStatus === "safe") return "✅ Safe";
    return row.message || "Completed";
  }
  if (row.phase === "failed") {
    return row.message || "Failed";
  }
  return row.message || "";
}


function UploadFields({
  upTitle,
  setUpTitle,
  upDesc,
  setUpDesc,
  upFile,
  setUpFile,
  uploadErr,
}) {
  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={12}>
          <Stack spacing={2}>
            <TextField
              label="Title"
              value={upTitle}
              onChange={(e) => setUpTitle(e.target.value)}
              required
              fullWidth
              size="small"
              placeholder="Video title"
            />
            <TextField
              label="Description"
              value={upDesc}
              onChange={(e) => setUpDesc(e.target.value)}
              required
              fullWidth
              size="small"
              multiline
              minRows={2}
              placeholder="Describe this video"
            />
          </Stack>
        </Grid>
        <Grid size={12}>
          <Paper
            variant="outlined"
            component="label"
            sx={{
              display: "block",
              p: 2.5,
              borderStyle: "dashed",
              borderWidth: 2,
              cursor: "pointer",
              textAlign: "center",
              bgcolor: "background.paper",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:hover": {
                borderColor: "error.main",
                bgcolor: "action.hover",
              },
            }}
          >
            <input
              type="file"
              hidden
              accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
              onChange={(e) => setUpFile(e.target.files?.[0] || null)}
            />
            <Stack spacing={0.75} alignItems="center">
              <Typography variant="subtitle2" fontWeight={600}>
                Choose video file
              </Typography>
              <Typography variant="caption" color="text.secondary">
                MP4, WebM, or MOV
              </Typography>
              <Typography
                variant="body2"
                color={upFile ? "text.primary" : "text.disabled"}
                sx={{ mt: 0.5, fontWeight: upFile ? 500 : 400 }}
              >
                {upFile ? upFile.name : "No file selected — click here to browse"}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      {uploadErr ? (
        <Typography color="error" variant="body2" role="alert">
          {uploadErr}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function OrgVideosPage() {
  const { token, user, setActiveOrganizationId } = useAuth();
  const organizations = useStableOrganizations(user?.organizations);
  const orgId = user?.activeOrganizationId;

  const canUploadAnywhere = useMemo(
    () =>
      organizations.some(
        (o) => o.orgRole === "admin" || o.orgRole === "editor"
      ),
    [organizations]
  );

  const [videos, setVideos] = useState([]);
  const [videoTotal, setVideoTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [livePipeline, setLivePipeline] = useState({});
  const [xhrUploadPercent, setXhrUploadPercent] = useState(null);
  const loadVideosRef = useRef(null);
  const loadInFlightRef = useRef(false);

  const [fSafety, setFSafety] = useState("");
  const [fProcessing, setFProcessing] = useState("");
  const [fQ, setFQ] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [fFileSizeBytes, setFFileSizeBytes] = useState("");

  const [upTitle, setUpTitle] = useState("");
  const [upDesc, setUpDesc] = useState("");
  const [upFile, setUpFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [modalOrgId, setModalOrgId] = useState("");

  const [editVideo, setEditVideo] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editUploadPercent, setEditUploadPercent] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");

  const [deleteVideo, setDeleteVideo] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");

  const modalOrgRole = useMemo(() => {
    if (!modalOrgId) return null;
    return organizations.find((o) => o.id === modalOrgId)?.orgRole ?? null;
  }, [modalOrgId, organizations]);

  const canUploadInModal =
    modalOrgRole === "admin" || modalOrgRole === "editor";

  const chipOrgs = useMemo(
    () => organizationsForChips(organizations, orgId),
    [organizations, orgId]
  );

  const [tableOrgFilter, setTableOrgFilter] = useState("all");

  const pipelineOrgIds = useMemo(() => {
    if (chipOrgs.length) return new Set(chipOrgs.map((o) => String(o.id)));
    if (orgId) return new Set([String(orgId)]);
    return new Set();
  }, [chipOrgs, orgId]);

  const visiblePipelineEntries = useMemo(() => {
    return Object.entries(livePipeline).filter(
      ([, row]) =>
        pipelineOrgIds.has(String(row.organizationId)) &&
        row.phase !== "uploading"
    );
  }, [livePipeline, pipelineOrgIds]);

  const loadVideos = useCallback(
    async (opts = {}) => {
      const force = opts.force === true;
      if (!force && loadInFlightRef.current) return;

      const pageIndex = opts.page ?? page;
      const pageSize = opts.rowsPerPage ?? rowsPerPage;
      const filterQuery = {
        safety: fSafety || undefined,
        processing: fProcessing || undefined,
        q: fQ,
        dateFrom: fDateFrom || undefined,
        dateTo: fDateTo || undefined,
        maxSize: fFileSizeBytes || undefined,
      };

      if (!token) {
        setVideos([]);
        setVideoTotal(0);
        setLoading(false);
        return;
      }

      if (!force) {
        loadInFlightRef.current = true;
        setLoading(true);
      }
      setError("");
      try {
        if (chipOrgs.length === 0) {
          const targetOrgId = opts.organizationId ?? orgId;
          if (!targetOrgId) {
            setVideos([]);
            setVideoTotal(0);
            return;
          }
          const { videos: list, total } = await fetchOrgVideos(
            token,
            targetOrgId,
            {
              ...filterQuery,
              limit: pageSize,
              skip: pageIndex * pageSize,
            }
          );
          setVideos(list);
          setVideoTotal(total);
          return;
        }

        if (tableOrgFilter === "all") {
          const results = await Promise.all(
            chipOrgs.map((o) =>
              fetchOrgVideos(token, o.id, {
                ...filterQuery,
                limit: MERGE_FETCH_LIMIT,
                skip: 0,
              })
            )
          );
          const byId = new Map();
          for (const { videos: list } of results) {
            for (const v of list) {
              if (!byId.has(v.id)) byId.set(v.id, v);
            }
          }
          const merged = [...byId.values()].sort(
            (a, b) =>
              new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          );
          const total = merged.length;
          const start = pageIndex * pageSize;
          setVideos(merged.slice(start, start + pageSize));
          setVideoTotal(total);
          return;
        }

        const targetOrgId = tableOrgFilter;
        const { videos: list, total } = await fetchOrgVideos(
          token,
          targetOrgId,
          {
            ...filterQuery,
            limit: pageSize,
            skip: pageIndex * pageSize,
          }
        );
        setVideos(list);
        setVideoTotal(total);
      } catch (e) {
        setError(e.message || "Could not load videos");
        setVideos([]);
        setVideoTotal(0);
      } finally {
        if (!force) {
          loadInFlightRef.current = false;
          setLoading(false);
        }
      }
    },
    [
      token,
      orgId,
      chipOrgs,
      tableOrgFilter,
      page,
      rowsPerPage,
      fSafety,
      fProcessing,
      fQ,
      fDateFrom,
      fDateTo,
      fFileSizeBytes,
    ]
  );

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    setPage(0);
  }, [orgId]);

  useEffect(() => {
    loadVideosRef.current = loadVideos;
  }, [loadVideos]);

  useEffect(() => {
    if (!token) return;

    const socket = io(getApiOrigin(), {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const onProgress = (data) => {
      if (!data?.videoId || data.organizationId == null) return;

      setLivePipeline((prev) => {
        const id = data.videoId;
        const cur = prev[id] || {};
        const next = { ...prev };
        next[id] = {
          organizationId: String(data.organizationId),
          fileName: data.fileName ?? cur.fileName,
          title: data.title ?? cur.title,
          phase: data.phase ?? cur.phase,
          uploadPercent:
            data.uploadPercent != null
              ? data.uploadPercent
              : data.phase === "upload_complete"
                ? 100
                : (cur.uploadPercent ?? 0),
          processingPercent: data.processingPercent ?? cur.processingPercent ?? 0,
          processingStatus: data.processingStatus ?? cur.processingStatus,
          sensitivityStatus: data.sensitivityStatus ?? cur.sensitivityStatus,
          message: data.message ?? cur.message,
        };
        return next;
      });

      if (data.phase === "completed" || data.phase === "failed") {
        void loadVideosRef.current?.({
          organizationId: String(data.organizationId),
          force: true,
        });
        const vid = data.videoId;
        window.setTimeout(() => {
          setLivePipeline((prev) => {
            if (!prev[vid]) return prev;
            const { [vid]: _drop, ...rest } = prev;
            return rest;
          });
        }, 8000);
      }
    };

    socket.on("video:progress", onProgress);
    return () => {
      socket.off("video:progress", onProgress);
      socket.disconnect();
    };
  }, [token]);

  const openUploadModal = () => {
    setUploadErr("");
    setModalOrgId(orgId || organizations[0]?.id || "");
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setUploadModalOpen(false);
    setUploadErr("");
  };

  const handleUpload = async () => {
    setUploadErr("");
    if (!upTitle.trim()) {
      setUploadErr("Title is required.");
      return;
    }
    if (!upDesc.trim()) {
      setUploadErr("Description is required.");
      return;
    }
    if (!upFile) {
      setUploadErr("Choose a video file.");
      return;
    }
    if (!token || !modalOrgId) {
      setUploadErr("Select an organization.");
      return;
    }
    if (!canUploadInModal) {
      setUploadErr("You can only upload as an admin or editor in this organization.");
      return;
    }

    setActiveOrganizationId(modalOrgId);

    setXhrUploadPercent(0);
    setUploading(true);
    try {
      const v = await uploadOrgVideo(
        token,
        modalOrgId,
        upFile,
        upTitle.trim(),
        upDesc.trim(),
        {
          onUploadProgress: (pct) => {
            setXhrUploadPercent(pct);
          },
        }
      );

      setXhrUploadPercent(null);
      if (v?.id) {
        setLivePipeline((prev) => ({
          ...prev,
          [v.id]: {
            organizationId: String(modalOrgId),
            fileName: v.originalFilename || upFile.name,
            title: v.title,
            phase: "upload_complete",
            uploadPercent: 100,
            processingPercent: 0,
            processingStatus: v.processingStatus || "uploaded",
            sensitivityStatus: v.sensitivityStatus,
            message: "Upload complete — processing…",
          },
        }));
      }

      setUpTitle("");
      setUpDesc("");
      setUpFile(null);
      setUploadModalOpen(false);
      void loadVideos({ organizationId: modalOrgId, force: true });
    } catch (e) {
      setXhrUploadPercent(null);
      setUploadErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFilters = () => {
    setFSafety("");
    setFProcessing("");
    setFQ("");
    setFDateFrom("");
    setFDateTo("");
    setFFileSizeBytes("");
    setPage(0);
  };

  const openEditDialog = (v) => {
    setEditErr("");
    setEditFile(null);
    setEditUploadPercent(null);
    setEditVideo(v);
    setEditTitle(v.title || "");
    setEditDesc(v.description ?? "");
  };

  const closeEditDialog = () => {
    if (editSaving) return;
    setEditVideo(null);
    setEditFile(null);
    setEditUploadPercent(null);
    setEditErr("");
  };

  const saveEditDialog = async () => {
    if (!token || !editVideo) return;
    const orgVid = orgIdForVideo(editVideo);
    if (!orgVid) {
      setEditErr("Missing organization for this video.");
      return;
    }
    const title = editTitle.trim();
    if (!title) {
      setEditErr("Title is required.");
      return;
    }
    const descTrim = editDesc.trim();
    if (editFile && !descTrim) {
      setEditErr("Description is required when uploading a new video file.");
      return;
    }

    setEditSaving(true);
    setEditErr("");
    try {
      if (editFile) {
        setEditUploadPercent(0);
        const v = await replaceOrgVideo(
          token,
          orgVid,
          editVideo.id,
          editFile,
          title,
          descTrim,
          {
            onUploadProgress: (pct) => setEditUploadPercent(pct),
          }
        );
        setEditUploadPercent(null);
        if (v?.id) {
          setLivePipeline((prev) => ({
            ...prev,
            [v.id]: {
              organizationId: String(orgVid),
              fileName: v.originalFilename || editFile.name,
              title: v.title,
              phase: "upload_complete",
              uploadPercent: 100,
              processingPercent: 0,
              processingStatus: v.processingStatus || "uploaded",
              sensitivityStatus: v.sensitivityStatus,
              message: "Replacement uploaded — processing…",
            },
          }));
        }
        setEditVideo(null);
        setEditFile(null);
        void loadVideos({ force: true });
      } else {
        await patchOrgVideo(token, orgVid, editVideo.id, {
          title,
          description: descTrim,
        });
        setEditVideo(null);
        void loadVideos({ force: true });
      }
    } catch (e) {
      setEditErr(e.message || "Update failed");
    } finally {
      setEditSaving(false);
      setEditUploadPercent(null);
    }
  };

  const openDeleteDialog = (v) => {
    setDeleteErr("");
    setDeleteVideo(v);
  };

  const closeDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteVideo(null);
    setDeleteErr("");
  };

  const confirmDeleteVideo = async () => {
    if (!token || !deleteVideo) return;
    const orgVid = orgIdForVideo(deleteVideo);
    if (!orgVid) {
      setDeleteErr("Missing organization for this video.");
      return;
    }
    setDeleteLoading(true);
    setDeleteErr("");
    try {
      await deleteOrgVideo(token, orgVid, deleteVideo.id);
      setDeleteVideo(null);
      void loadVideos({ force: true });
    } catch (e) {
      setDeleteErr(e.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!organizations.length) {
    return (
      <SiteChrome title="Videos">
        <main className="org-panel">
          <Typography variant="body2" color="text.secondary">
            You do not belong to any organization yet.{" "}
            <Link href="/organization" className="auth-link">
              Create one
            </Link>{" "}
            to upload videos.
          </Typography>
        </main>
      </SiteChrome>
    );
  }

  const uploadBlockProps = {
    upTitle,
    setUpTitle,
    upDesc,
    setUpDesc,
    upFile,
    setUpFile,
    uploadErr,
  };

  return (
    <SiteChrome title="Videos">
      <main className="org-panel">
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            mb: 2,
          }}
        >
          {canUploadAnywhere ? (
            <Button
              variant="contained"
              color="error"
              sx={{ textTransform: "none", fontWeight: 600 }}
              onClick={openUploadModal}
            >
              Upload
            </Button>
          ) : null}
        </Box>



        <Dialog
          open={uploadModalOpen}
          onClose={closeUploadModal}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: { sx: { borderRadius: 2 } },
          }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Upload a video</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              File is sent to the server and analyzed; it appears in the table below when ready.
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel id="upload-modal-org-label">Organization</InputLabel>
              <Select
                labelId="upload-modal-org-label"
                label="Organization"
                value={modalOrgId || ""}
                onChange={(e) => setModalOrgId(e.target.value)}
              >
                {organizations.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {modalOrgId && !canUploadInModal ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                You are a viewer in this organization. Choose an org where you are an admin or editor.
              </Typography>
            ) : null}
            <UploadFields {...uploadBlockProps} />
            {xhrUploadPercent !== null ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Upload {xhrUploadPercent}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={xhrUploadPercent}
                  sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
                  color="error"
                />
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeUploadModal}
              disabled={uploading}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              sx={dialogPrimaryButtonSx}
              disabled={uploading || !canUploadInModal}
              onClick={() => void handleUpload()}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(editVideo)}
          onClose={closeEditDialog}
          maxWidth="sm"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Edit video</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
             
              <TextField
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                fullWidth
                size="small"
                required
              />
              <TextField
                label="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
                required={Boolean(editFile)}
               
              />
              <Paper
                variant="outlined"
                component="label"
                sx={{
                  display: "block",
                  p: 2,
                  borderStyle: "dashed",
                  borderWidth: 2,
                  cursor: "pointer",
                  textAlign: "center",
                  bgcolor: "background.paper",
                  transition: "border-color 0.2s, background-color 0.2s",
                  "&:hover": {
                    borderColor: "error.main",
                    bgcolor: "action.hover",
                  },
                }}
              >
                <input
                  type="file"
                  hidden
                  accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                />
                <Typography variant="subtitle2" fontWeight={600}>
                  Replace video file (optional)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  MP4, WebM, or MOV — leave unchanged to keep the current file
                </Typography>
                <Typography
                  variant="body2"
                  color={editFile ? "text.primary" : "text.disabled"}
                  sx={{ mt: 1, fontWeight: editFile ? 500 : 400 }}
                >
                  {editFile
                    ? editFile.name
                    : "No new file selected"}
                </Typography>
              </Paper>
              {editUploadPercent !== null ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Upload {editUploadPercent}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={editUploadPercent}
                    sx={{ mt: 0.5, height: 8, borderRadius: 1 }}
                    color="error"
                  />
                </Box>
              ) : null}
              {editErr ? (
                <Typography color="error" variant="body2" role="alert">
                  {editErr}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeEditDialog}
              disabled={editSaving}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={editSaving}
              sx={dialogPrimaryButtonSx}
              onClick={() => void saveEditDialog()}
            >
              {editSaving
                ? editFile
                  ? "Uploading…"
                  : "Saving…"
                : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteVideo)}
          onClose={closeDeleteDialog}
          maxWidth="xs"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Delete video</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.primary">
              Are you sure want to delete this video
            </Typography>
            {deleteErr ? (
              <Typography color="error" variant="body2" role="alert" sx={{ mt: 2 }}>
                {deleteErr}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeDeleteDialog}
              disabled={deleteLoading}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteLoading}
              sx={dialogPrimaryButtonSx}
              onClick={() => void confirmDeleteVideo()}
            >
              {deleteLoading ? "…" : "Yes Confirm"}
            </Button>
          </DialogActions>
        </Dialog>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Safety</InputLabel>
              <Select
                value={fSafety}
                label="Safety"
                onChange={(e) => {
                  setFSafety(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="safe">safe</MenuItem>
                <MenuItem value="flagged">flagged</MenuItem>
                <MenuItem value="pending">pending</MenuItem>
                <MenuItem value="processing">processing</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Processing</InputLabel>
              <Select
                value={fProcessing}
                label="Processing"
                onChange={(e) => {
                  setFProcessing(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value="ready">ready</MenuItem>
                <MenuItem value="failed">failed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Search"
              value={fQ}
              onChange={(e) => {
                setFQ(e.target.value);
                setPage(0);
              }}
              fullWidth
              size="small"
              placeholder="Title / description"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              label="From date"
              type="date"
              value={fDateFrom}
              onChange={(e) => {
                setFDateFrom(e.target.value);
                setPage(0);
              }}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              label="To date"
              type="date"
              value={fDateTo}
              onChange={(e) => {
                setFDateTo(e.target.value);
                setPage(0);
              }}
              fullWidth
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label="File size (bytes)"
              value={fFileSizeBytes}
              onChange={(e) => {
                setFFileSizeBytes(e.target.value);
                setPage(0);
              }}
              fullWidth
              size="small"
              placeholder="e.g. 500000000"
              helperText="Show videos up to this size in bytes"
              slotProps={{
                htmlInput: { inputMode: "numeric", pattern: "[0-9]*" },
              }}
            />
          </Grid>
        </Grid>
        <Button
          variant="outlined"
          sx={{ mb: 2, textTransform: "none" }}
          onClick={clearFilters}
        >
          Clear filters
        </Button>

        {chipOrgs.length > 0 ? (
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            sx={{ mb: 2, columnGap: 1, rowGap: 1 }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
              Organization
            </Typography>
            <Chip
              label="All"
              onClick={() => {
                setTableOrgFilter("all");
                setPage(0);
              }}
              color={tableOrgFilter === "all" ? "error" : "default"}
              variant={tableOrgFilter === "all" ? "filled" : "outlined"}
              clickable
              sx={{ fontWeight: tableOrgFilter === "all" ? 600 : 400 }}
            />
            {chipOrgs.map((o) => {
              const selected = String(tableOrgFilter) === String(o.id);
              return (
                <Chip
                  key={o.id}
                  label={o.name}
                  onClick={() => {
                    setTableOrgFilter(String(o.id));
                    setPage(0);
                  }}
                  color={selected ? "error" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  clickable
                  sx={{ fontWeight: selected ? 600 : 400 }}
                />
              );
            })}
          </Stack>
        ) : null}

        {visiblePipelineEntries.length > 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              borderStyle: "dashed",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Live upload and processing
            </Typography>
            <Stack spacing={2}>
              {visiblePipelineEntries.map(([key, row]) => (
                <Box key={key}>
                  <Typography variant="body2" fontWeight={600}>
                    {row.fileName || row.title || "Video"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {pipelineStatusLine(row)}
                  </Typography>
                  {row.message && row.phase === "processing" ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.message}
                    </Typography>
                  ) : null}
                  {row.phase === "upload_complete" || row.phase === "processing" ? (
                    <LinearProgress
                      variant="determinate"
                      value={row.processingPercent ?? 0}
                      sx={{ mt: 1, height: 8, borderRadius: 1 }}
                      color="primary"
                    />
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Paper>
        ) : null}

        {loading ? (
          <div className="home-loading" aria-busy="true">
            <span className="auth-loading-dot" />
            <p>Loading…</p>
          </div>
        ) : null}
        {error && !loading ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="org-table-wrap">
              <table className="org-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Title</th>
                    <th>Processing</th>
                    <th>Safety</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th style={{ width: "5.5rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <Typography variant="body2" color="text.secondary">
                          No videos match these filters yet.
                        </Typography>
                      </td>
                    </tr>
                  ) : (
                    videos.map((v) => {
                      const canEdit = canEditOrgVideo(v, organizations);
                      const canDelete = canDeleteOrgVideo(v, organizations);
                      return (
                        <tr key={v.id}>
                          <td>{orgNameForVideo(v, organizations)}</td>
                          <td>{v.title}</td>
                          <td>{v.processingStatus}</td>
                          <td>{v.sensitivityStatus}</td>
                          <td>{formatBytes(v.fileSize)}</td>
                          <td>{formatDate(v.createdAt)}</td>
                          <td>
                            {canEdit || canDelete ? (
                              <Stack direction="row" spacing={0} alignItems="center">
                                {canEdit ? (
                                  <IconButton
                                    size="small"
                                    aria-label="Edit video"
                                    onClick={() => openEditDialog(v)}
                                    sx={{ color: "text.secondary" }}
                                  >
                                    <svg
                                      width="18"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      aria-hidden
                                    >
                                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                    </svg>
                                  </IconButton>
                                ) : null}
                                {canDelete ? (
                                  <IconButton
                                    size="small"
                                    aria-label="Delete video"
                                    onClick={() => openDeleteDialog(v)}
                                    sx={{ color: "error.main" }}
                                  >
                                    <svg
                                      width="18"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      aria-hidden
                                    >
                                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                    </svg>
                                  </IconButton>
                                ) : null}
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {videoTotal > 0 ? (
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
          </>
        ) : null}
      </main>
    </SiteChrome>
  );
}
