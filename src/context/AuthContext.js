"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchMyOrganizations } from "@/lib/orgApi";

const TOKEN_KEY = "streamhub_token";
const USER_KEY = "streamhub_user";
const ACTIVE_ORG_KEY = "streamhub_active_org";

const AuthContext = createContext(null);

function getApiBase() {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
    "http://localhost:8000/api"
  );
}

function mergeUserProfile(profile, storedOrgId) {
  const organizations = Array.isArray(profile.organizations) ? profile.organizations : [];
  if (!organizations.length) {
    return { ...profile, organizations, activeOrganizationId: null };
  }
  const ids = new Set(organizations.map((o) => o.id));
  const fromApi =
    profile.activeOrganizationId && ids.has(profile.activeOrganizationId)
      ? profile.activeOrganizationId
      : null;
  const fromStorage = storedOrgId && ids.has(storedOrgId) ? storedOrgId : null;
  const activeOrganizationId = fromApi || fromStorage || organizations[0].id;
  return { ...profile, organizations, activeOrganizationId };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(USER_KEY);
      if (t && raw) {
        const parsed = JSON.parse(raw);
        const storedOrg = localStorage.getItem(ACTIVE_ORG_KEY);
        const merged = mergeUserProfile(parsed, storedOrg);
        setToken(t);
        setUser(merged);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ACTIVE_ORG_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const orgs = await fetchMyOrganizations(token);
        if (cancelled) return;
        setUser((u) => {
          if (!u) return u;
          const stored = localStorage.getItem(ACTIVE_ORG_KEY);
          const next = mergeUserProfile({ ...u, organizations: orgs }, stored);
          localStorage.setItem(USER_KEY, JSON.stringify(next));
          if (next.activeOrganizationId) {
            localStorage.setItem(ACTIVE_ORG_KEY, next.activeOrganizationId);
          } else {
            localStorage.removeItem(ACTIVE_ORG_KEY);
          }
          return next;
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const persistSession = useCallback((accessToken, profile) => {
    const stored = localStorage.getItem(ACTIVE_ORG_KEY);
    const merged = mergeUserProfile(profile, stored);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
    if (merged.activeOrganizationId) {
      localStorage.setItem(ACTIVE_ORG_KEY, merged.activeOrganizationId);
    } else {
      localStorage.removeItem(ACTIVE_ORG_KEY);
    }
    setToken(accessToken);
    setUser(merged);
  }, []);

  const login = useCallback(
    async (identifier, password) => {
      const res = await fetch(`${getApiBase()}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Login failed");
      }
      persistSession(data.access_token, data.user);
    },
    [persistSession]
  );

  const register = useCallback(
    async (name, email, phone, password, organizationName) => {
      const res = await fetch(`${getApiBase()}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          organizationName: organizationName?.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "success") {
        throw new Error(data.message || "Sign up failed");
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACTIVE_ORG_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const setActiveOrganizationId = useCallback((id) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, activeOrganizationId: id };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      if (id) localStorage.setItem(ACTIVE_ORG_KEY, id);
      else localStorage.removeItem(ACTIVE_ORG_KEY);
      return next;
    });
  }, []);

  const refreshOrganizations = useCallback(async () => {
    if (!token) return;
    const orgs = await fetchMyOrganizations(token);
    setUser((u) => {
      if (!u) return u;
      const stored = localStorage.getItem(ACTIVE_ORG_KEY);
      const next = mergeUserProfile({ ...u, organizations: orgs }, stored);
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      if (next.activeOrganizationId) {
        localStorage.setItem(ACTIVE_ORG_KEY, next.activeOrganizationId);
      } else {
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
      return next;
    });
  }, [token]);

  const updateSessionUser = useCallback((partial) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...partial };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      login,
      register,
      logout,
      setActiveOrganizationId,
      refreshOrganizations,
      updateSessionUser,
    }),
    [
      user,
      token,
      ready,
      login,
      register,
      logout,
      setActiveOrganizationId,
      refreshOrganizations,
      updateSessionUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
