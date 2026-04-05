"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Table,
  TableBody,
  TablePagination,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import SiteChrome from "@/components/SiteChrome";
import { useAuth } from "@/context/AuthContext";
import { dialogCancelButtonSx, dialogPrimaryButtonSx } from "@/lib/dialogButtonSx";
import {
  createOrganization,
  addOrgMember,
  fetchOrgMembers,
  patchOrgMember,
  deleteOrgMember,
  patchOrganization,
  deleteOrganization,
} from "@/lib/orgApi";
import { digitsOnly } from "@/lib/authSchemas";

const NEW_MEMBER_ORG_ROLE = "viewer";

export default function OrganizationPage() {
  const { token, user, setActiveOrganizationId, refreshOrganizations, updateSessionUser } =
    useAuth();
  const organizations = user?.organizations || [];
  const activeId = user?.activeOrganizationId;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [creating, setCreating] = useState(false);

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersErr, setMembersErr] = useState("");

  const [mName, setMName] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mPassword, setMPassword] = useState("");
  const [mConfirmPassword, setMConfirmPassword] = useState("");
  const [memberErr, setMemberErr] = useState("");
  const [adding, setAdding] = useState(false);

  const [editMember, setEditMember] = useState(null);
  const [emName, setEmName] = useState("");
  const [emEmail, setEmEmail] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [emRole, setEmRole] = useState("viewer");
  const [editMemberErr, setEditMemberErr] = useState("");
  const [editMemberSaving, setEditMemberSaving] = useState(false);

  const [deleteMember, setDeleteMember] = useState(null);
  const [deleteMemberErr, setDeleteMemberErr] = useState("");
  const [deleteMemberLoading, setDeleteMemberLoading] = useState(false);

  const [memberPage, setMemberPage] = useState(0);
  const [memberRowsPerPage, setMemberRowsPerPage] = useState(10);

  const [allOrgsModalOpen, setAllOrgsModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [editOrgName, setEditOrgName] = useState("");
  const [editOrgErr, setEditOrgErr] = useState("");
  const [editOrgSaving, setEditOrgSaving] = useState(false);
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [deleteOrgErr, setDeleteOrgErr] = useState("");
  const [deleteOrgLoading, setDeleteOrgLoading] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!token || !activeId) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setMembersErr("");
    try {
      const list = await fetchOrgMembers(token, activeId);
      setMembers(list);
    } catch (e) {
      setMembersErr(e.message || "Could not load members");
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [token, activeId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setMemberPage(0);
  }, [activeId]);

  const memberTotal = members.length;
  const maxMemberPage = Math.max(0, Math.ceil(memberTotal / memberRowsPerPage) - 1);
  useEffect(() => {
    if (memberPage > maxMemberPage) setMemberPage(maxMemberPage);
  }, [memberPage, maxMemberPage]);

  const pagedMembers = useMemo(() => {
    const start = memberPage * memberRowsPerPage;
    return members.slice(start, start + memberRowsPerPage);
  }, [members, memberPage, memberRowsPerPage]);

  const openCreateModal = () => {
    setNewOrgName("");
    setCreateErr("");
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (!creating) setCreateModalOpen(false);
  };

  const handleCreateOrg = async () => {
    setCreateErr("");
    if (!newOrgName.trim()) {
      setCreateErr("Enter a name.");
      return;
    }
    if (!token) return;
    setCreating(true);
    try {
      await createOrganization(token, newOrgName.trim());
      setNewOrgName("");
      setCreateModalOpen(false);
      await refreshOrganizations();
    } catch (e) {
      setCreateErr(e.message || "Failed");
    } finally {
      setCreating(false);
    }
  };

  const activeRole = organizations.find((o) => o.id === activeId)?.orgRole;
  const isAdmin = activeRole === "admin";

  const handleAddMember = async () => {
    setMemberErr("");
    const phone = digitsOnly(mPhone);
    if (!activeId) {
      setMemberErr("Select an organization.");
      return;
    }
    if (!mName.trim() || !mEmail.trim() || phone.length !== 10) {
      setMemberErr("Name, email, and 10-digit phone are required.");
      return;
    }
    if (!mPassword || mPassword.length < 6) {
      setMemberErr("Password (min 6 characters) is required.");
      return;
    }
    if (mPassword !== mConfirmPassword) {
      setMemberErr("Passwords do not match.");
      return;
    }
    if (!token) return;
    setAdding(true);
    try {
      await addOrgMember(token, activeId, {
        name: mName.trim(),
        email: mEmail.trim().toLowerCase(),
        phone,
        password: mPassword,
        role: NEW_MEMBER_ORG_ROLE,
      });
      setMName("");
      setMEmail("");
      setMPhone("");
      setMPassword("");
      setMConfirmPassword("");
      await loadMembers();
    } catch (e) {
      setMemberErr(e.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const openEditMember = (m) => {
    setEditMemberErr("");
    setEditMember(m);
    setEmName(m.name || "");
    setEmEmail(m.email || "");
    setEmPhone(m.phone || "");
    setEmRole(m.orgRole || "viewer");
  };

  const closeEditMember = () => {
    if (editMemberSaving) return;
    setEditMember(null);
    setEditMemberErr("");
  };

  const saveEditMember = async () => {
    if (!token || !activeId || !editMember) return;
    setEditMemberErr("");
    const phone = digitsOnly(emPhone);
    if (!emName.trim() || !emEmail.trim()) {
      setEditMemberErr("Name and email are required.");
      return;
    }
    if (phone.length !== 10) {
      setEditMemberErr("Phone must be exactly 10 digits.");
      return;
    }
    setEditMemberSaving(true);
    try {
      const updated = await patchOrgMember(token, activeId, editMember.userId, {
        name: emName.trim(),
        email: emEmail.trim().toLowerCase(),
        phone,
        orgRole: emRole,
      });
      if (String(editMember.userId) === String(user?.id)) {
        updateSessionUser({
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
        });
      }
      await loadMembers();
      await refreshOrganizations();
      setEditMember(null);
    } catch (e) {
      setEditMemberErr(e.message || "Update failed");
    } finally {
      setEditMemberSaving(false);
    }
  };

  const openDeleteMember = (m) => {
    setDeleteMemberErr("");
    setDeleteMember(m);
  };

  const closeDeleteMember = () => {
    if (deleteMemberLoading) return;
    setDeleteMember(null);
    setDeleteMemberErr("");
  };

  const confirmDeleteMember = async () => {
    if (!token || !activeId || !deleteMember) return;
    setDeleteMemberLoading(true);
    setDeleteMemberErr("");
    try {
      await deleteOrgMember(token, activeId, deleteMember.userId);
      await loadMembers();
      await refreshOrganizations();
      setDeleteMember(null);
    } catch (e) {
      setDeleteMemberErr(e.message || "Remove failed");
    } finally {
      setDeleteMemberLoading(false);
    }
  };

  const openAllOrgsModal = () => {
    void (async () => {
      await refreshOrganizations();
      setAllOrgsModalOpen(true);
    })();
  };

  const closeAllOrgsModal = () => {
    setAllOrgsModalOpen(false);
  };

  const openEditOrg = (o) => {
    setEditOrgErr("");
    setEditOrg(o);
    setEditOrgName(o.name || "");
  };

  const closeEditOrg = () => {
    if (editOrgSaving) return;
    setEditOrg(null);
    setEditOrgErr("");
  };

  const saveEditOrg = async () => {
    if (!token || !editOrg) return;
    const name = editOrgName.trim();
    if (!name) {
      setEditOrgErr("Enter a name.");
      return;
    }
    setEditOrgSaving(true);
    setEditOrgErr("");
    try {
      await patchOrganization(token, editOrg.id, { name });
      await refreshOrganizations();
      setEditOrg(null);
    } catch (e) {
      setEditOrgErr(e.message || "Update failed");
    } finally {
      setEditOrgSaving(false);
    }
  };

  const openDeleteOrg = (o) => {
    setDeleteOrgErr("");
    setDeleteOrg(o);
  };

  const closeDeleteOrg = () => {
    if (deleteOrgLoading) return;
    setDeleteOrg(null);
    setDeleteOrgErr("");
  };

  const confirmDeleteOrg = async () => {
    if (!token || !deleteOrg) return;
    setDeleteOrgLoading(true);
    setDeleteOrgErr("");
    try {
      await deleteOrganization(token, deleteOrg.id);
      await refreshOrganizations();
      setDeleteOrg(null);
      setAllOrgsModalOpen(false);
    } catch (e) {
      setDeleteOrgErr(e.message || "Delete failed");
    } finally {
      setDeleteOrgLoading(false);
    }
  };

  return (
    <SiteChrome title="Organization">
      <main className="org-panel">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "flex-end" }}
          sx={{ flexWrap: "wrap", mb: 3 }}
        >
          <FormControl sx={{ flex: "1 1 240px", minWidth: 200, maxWidth: 480 }}>
            <InputLabel id="active-org-label">Active organization</InputLabel>
            <Select
              labelId="active-org-label"
              id="active-org"
              label="Active organization"
              value={activeId || ""}
              onChange={(e) => setActiveOrganizationId(e.target.value)}
            >
              {organizations.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            {isAdmin ? (
              <Button
                variant="outlined"
                color="error"
                onClick={openAllOrgsModal}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                View all organization
              </Button>
            ) : null}
            <Button
              variant="contained"
              color="error"
              onClick={openCreateModal}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Create organization
            </Button>
          </Stack>
        </Stack>

        <Dialog
          open={allOrgsModalOpen}
          onClose={closeAllOrgsModal}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>All organizations</DialogTitle>
          <DialogContent>
            {organizations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                You are not a member of any organization yet.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small" aria-label="Your organizations">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 108 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {organizations.map((o) => {
                      const canEdit = o.orgRole === "admin";
                      const canDelete = Boolean(o.isOrganizationCreator);
                      return (
                        <TableRow key={o.id} hover>
                          <TableCell>{o.name}</TableCell>
                          <TableCell>
                            {canEdit || canDelete ? (
                              <Stack direction="row" spacing={0} alignItems="center">
                                {canEdit ? (
                                  <IconButton
                                    size="small"
                                    aria-label={`Edit organization ${o.name}`}
                                    onClick={() => openEditOrg(o)}
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
                                    aria-label={`Delete organization ${o.name}`}
                                    onClick={() => openDeleteOrg(o)}
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={closeAllOrgsModal} sx={dialogCancelButtonSx}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(editOrg)}
          onClose={closeEditOrg}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Edit organization</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Organization name"
              value={editOrgName}
              onChange={(e) => setEditOrgName(e.target.value)}
              fullWidth
              size="small"
              sx={{ mt: 1 }}
            />
            {editOrgErr ? (
              <Typography color="error" variant="body2" sx={{ mt: 1.5 }} role="alert">
                {editOrgErr}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeEditOrg}
              disabled={editOrgSaving}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={editOrgSaving}
              onClick={() => void saveEditOrg()}
              sx={dialogPrimaryButtonSx}
            >
              {editOrgSaving ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteOrg)}
          onClose={closeDeleteOrg}
          maxWidth="xs"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Delete organization</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.primary">
              Are you sure want to delete this organization? All videos and members in it will be
              removed. This cannot be undone.
            </Typography>
            {deleteOrgErr ? (
              <Typography color="error" variant="body2" role="alert" sx={{ mt: 2 }}>
                {deleteOrgErr}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeDeleteOrg}
              disabled={deleteOrgLoading}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteOrgLoading}
              onClick={() => void confirmDeleteOrg()}
              sx={dialogPrimaryButtonSx}
            >
              {deleteOrgLoading ? "…" : "Yes Confirm"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={createModalOpen}
          onClose={closeCreateModal}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Create organization</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Organization name"
              placeholder="e.g. Marketing team"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              fullWidth
              size="small"
              sx={{ mt: 1 }}
            />
            {createErr ? (
              <Typography color="error" variant="body2" sx={{ mt: 1.5 }} role="alert">
                {createErr}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeCreateModal}
              disabled={creating}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={creating}
              onClick={() => void handleCreateOrg()}
              sx={dialogPrimaryButtonSx}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(editMember)}
          onClose={closeEditMember}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Edit member</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={emName}
                onChange={(e) => setEmName(e.target.value)}
                fullWidth
                size="small"
                required
              />
              <TextField
                label="Email"
                type="email"
                value={emEmail}
                onChange={(e) => setEmEmail(e.target.value)}
                fullWidth
                size="small"
                required
              />
              <TextField
                label="Phone (10 digits)"
                value={emPhone}
                onChange={(e) => setEmPhone(e.target.value)}
                fullWidth
                size="small"
                inputMode="tel"
              />
              <FormControl fullWidth size="small">
                <InputLabel id="edit-member-role-label">Role</InputLabel>
                <Select
                  labelId="edit-member-role-label"
                  label="Role"
                  value={emRole}
                  onChange={(e) => setEmRole(e.target.value)}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="editor">Editor</MenuItem>
                  <MenuItem value="viewer">Viewer</MenuItem>
                </Select>
              </FormControl>
              {editMemberErr ? (
                <Typography color="error" variant="body2" role="alert">
                  {editMemberErr}
                </Typography>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeEditMember}
              disabled={editMemberSaving}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={editMemberSaving}
              onClick={() => void saveEditMember()}
              sx={dialogPrimaryButtonSx}
            >
              {editMemberSaving ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteMember)}
          onClose={closeDeleteMember}
          maxWidth="xs"
          fullWidth
          slotProps={{ paper: { sx: { borderRadius: 2 } } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Remove member</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.primary">
              Are you sure want to delete this member
            </Typography>
            {deleteMemberErr ? (
              <Typography color="error" variant="body2" role="alert" sx={{ mt: 2 }}>
                {deleteMemberErr}
              </Typography>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              variant="contained"
              onClick={closeDeleteMember}
              disabled={deleteMemberLoading}
              sx={dialogCancelButtonSx}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteMemberLoading}
              onClick={() => void confirmDeleteMember()}
              sx={dialogPrimaryButtonSx}
            >
              {deleteMemberLoading ? "…" : "Yes Confirm"}
            </Button>
          </DialogActions>
        </Dialog>

        <Box
          component="section"
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
            mb: 3,
          }}
        >
         {isAdmin &&( <Typography variant="h6" component="h2" sx={{ mb: 1, fontWeight: 600 }}>
            Add member
          </Typography>)}
          {isAdmin && 
          (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Name"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  fullWidth
                  size="small"
                  autoComplete="name"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Email"
                  type="email"
                  value={mEmail}
                  onChange={(e) => setMEmail(e.target.value)}
                  fullWidth
                  size="small"
                  autoComplete="email"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Phone (10 digits)"
                  value={mPhone}
                  onChange={(e) => setMPhone(e.target.value)}
                  fullWidth
                  size="small"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="9876543210"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
            
                  <TextField
                    label="Password"
                    type="password"
                    value={mPassword}
                    onChange={(e) => setMPassword(e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="new-password"
                    helperText="Minimum 6 characters"
                    sx={{
                      flex: "1 1 0",
                      minWidth: 200,
                      maxWidth: "none",
                    }}
                  />

                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Confirm password"
                    type="password"
                    value={mConfirmPassword}
                    onChange={(e) => setMConfirmPassword(e.target.value)}
                    fullWidth
                    size="small"
                    autoComplete="new-password"
                    sx={{
                      flex: "1 1 0",
                      minWidth: 200,
                      maxWidth: "none",
                    }}
                  />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={adding}
                    onClick={() => void handleAddMember()}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {adding ? "Adding…" : "Add member"}
                  </Button>
             
              </Grid>
              {memberErr ? (
                <Grid size={12}>
                  <Typography color="error" variant="body2" role="alert">
                    {memberErr}
                  </Typography>
                </Grid>
              ) : null}
            </Grid>
          )}
        </Box>

        <Box component="section">
          <Typography variant="h6" component="h2" sx={{ mb: 2, fontWeight: 600 }}>
            Members
          </Typography>
          {membersLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading members…
            </Typography>
          ) : null}
          {membersErr ? (
            <Typography color="error" variant="body2" sx={{ mb: 2 }} role="alert">
              {membersErr}
            </Typography>
          ) : null}
          {!membersLoading && !membersErr && members.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No members in this organization yet.
            </Typography>
          ) : null}
          {!membersLoading && members.length > 0 ? (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
                <Table size="small" aria-label="Organization members">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                      {isAdmin ? (
                        <TableCell sx={{ fontWeight: 600, width: 108 }}>Actions</TableCell>
                      ) : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedMembers.map((m) => (
                      <TableRow key={m.userId} hover>
                        <TableCell>{m.name}</TableCell>
                        <TableCell sx={{ wordBreak: "break-all", maxWidth: 220 }}>{m.email}</TableCell>
                        <TableCell>{m.phone || "—"}</TableCell>
                        <TableCell sx={{ textTransform: "capitalize" }}>{m.orgRole}</TableCell>
                        {isAdmin ? (
                          <TableCell>
                            {m.isOrganizationCreator ? (
                              <Typography variant="caption" color="text.disabled">
                                —
                              </Typography>
                            ) : (
                              <Stack direction="row" spacing={0} alignItems="center">
                                <IconButton
                                  size="small"
                                  aria-label="Edit member"
                                  onClick={() => openEditMember(m)}
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
                                <IconButton
                                  size="small"
                                  aria-label="Remove member"
                                  onClick={() => openDeleteMember(m)}
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
                              </Stack>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                sx={{ borderTop: 1, borderColor: "divider" }}
                count={members.length}
                page={memberPage}
                onPageChange={(_, newPage) => setMemberPage(newPage)}
                rowsPerPage={memberRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setMemberRowsPerPage(Number.parseInt(e.target.value, 10));
                  setMemberPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Rows per page"
              />
            </>
          ) : null}
        </Box>
      </main>
    </SiteChrome>
  );
}
