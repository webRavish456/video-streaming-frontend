import { getApiBase } from "@/lib/videosApi";

function joinApi(path) {
  const base = getApiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function fetchMyOrganizations(token) {
  const res = await fetch(joinApi("/users/me/organizations"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not load organizations");
  }
  return data.organizations || [];
}

export async function createOrganization(token, name) {
  const res = await fetch(joinApi("/users/me/organizations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not create organization");
  }
  return data.organization;
}

export async function patchOrganization(token, organizationId, body) {
  const res = await fetch(joinApi(`/users/me/organizations/${organizationId}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not update organization");
  }
  return data.organization;
}

export async function deleteOrganization(token, organizationId) {
  const res = await fetch(joinApi(`/users/me/organizations/${organizationId}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not delete organization");
  }
}

export async function fetchOrgVideos(token, organizationId, query = {}) {
  const q = new URLSearchParams();
  if (query.safety) q.set("safety", query.safety);
  if (query.processing) q.set("processing", query.processing);
  if (query.q?.trim()) q.set("q", query.q.trim());
  if (query.dateFrom) q.set("dateFrom", query.dateFrom);
  if (query.dateTo) q.set("dateTo", query.dateTo);
  if (query.minSize != null && query.minSize !== "") q.set("minSize", String(query.minSize));
  if (query.maxSize != null && query.maxSize !== "") q.set("maxSize", String(query.maxSize));
  if (query.minDuration != null && query.minDuration !== "") {
    q.set("minDuration", String(query.minDuration));
  }
  if (query.maxDuration != null && query.maxDuration !== "") {
    q.set("maxDuration", String(query.maxDuration));
  }
  if (query.limit != null && query.limit !== "") {
    q.set("limit", String(query.limit));
  }
  if (query.skip != null && query.skip !== "") {
    q.set("skip", String(query.skip));
  }
  const url = joinApi(`/users/me/organizations/${organizationId}/videos`);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await fetch(`${url}${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not load videos");
  }
  return {
    videos: data.videos || [],
    total: typeof data.total === "number" ? data.total : (data.videos?.length ?? 0),
    limit: data.limit,
    skip: data.skip,
  };
}

export function replaceOrgVideo(
  token,
  organizationId,
  videoId,
  file,
  title,
  description,
  options = {}
) {
  const { onUploadProgress } = options;
  const url = joinApi(
    `/users/me/organizations/${organizationId}/videos/${videoId}/replace`
  );

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onUploadProgress === "function") {
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        onUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      const data = xhr.response;
      const ok =
        xhr.status >= 200 &&
        xhr.status < 300 &&
        data &&
        data.status === "success";
      if (ok) {
        resolve(data.video);
      } else {
        const msg =
          (data && data.message) || xhr.statusText || "Replace failed";
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));

    const fd = new FormData();
    fd.append("video", file);
    fd.append("title", title || file.name);
    fd.append("description", description || "");
    xhr.send(fd);
  });
}

export function uploadOrgVideo(
  token,
  organizationId,
  file,
  title,
  description,
  options = {}
) {
  const { onUploadProgress } = options;
  const url = joinApi(`/users/me/organizations/${organizationId}/videos`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onUploadProgress === "function") {
        const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
        onUploadProgress(pct);
      }
    };

    xhr.onload = () => {
      const data = xhr.response;
      const ok =
        xhr.status >= 200 &&
        xhr.status < 300 &&
        data &&
        data.status === "success";
      if (ok) {
        resolve(data.video);
      } else {
        const msg =
          (data && data.message) || xhr.statusText || "Upload failed";
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));

    const fd = new FormData();
    fd.append("video", file);
    fd.append("title", title || file.name);
    fd.append("description", description || "");
    xhr.send(fd);
  });
}

export async function patchOrgVideo(token, organizationId, videoId, body) {
  const res = await fetch(
    joinApi(
      `/users/me/organizations/${organizationId}/videos/${videoId}`
    ),
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not update video");
  }
  return data.video;
}

export async function deleteOrgVideo(token, organizationId, videoId) {
  const res = await fetch(
    joinApi(
      `/users/me/organizations/${organizationId}/videos/${videoId}`
    ),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not delete video");
  }
}

export async function fetchOrgVideoStatus(token, organizationId, videoId) {
  const res = await fetch(
    joinApi(
      `/users/me/organizations/${organizationId}/videos/${videoId}/status`
    ),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not load status");
  }
  return data.video;
}

export async function fetchOrgMembers(token, organizationId) {
  const res = await fetch(
    joinApi(`/users/me/organizations/${organizationId}/members`),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not load members");
  }
  return data.members || [];
}

export async function addOrgMember(token, organizationId, body) {
  const res = await fetch(
    joinApi(`/users/me/organizations/${organizationId}/members`),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not add member");
  }
  return data.member;
}

export async function patchOrgMember(token, organizationId, memberUserId, body) {
  const res = await fetch(
    joinApi(
      `/users/me/organizations/${organizationId}/members/${memberUserId}`
    ),
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not update member");
  }
  return data.member;
}

export async function patchMemberOrgRole(token, organizationId, memberUserId, orgRole) {
  return patchOrgMember(token, organizationId, memberUserId, { orgRole });
}

export async function deleteOrgMember(token, organizationId, memberUserId) {
  const res = await fetch(
    joinApi(
      `/users/me/organizations/${organizationId}/members/${memberUserId}`
    ),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || "Could not remove member");
  }
}
