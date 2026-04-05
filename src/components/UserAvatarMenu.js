"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function UserAvatarMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push("/login");
  };

  return (
    <div className="avatar-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="avatar-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <span className="avatar" aria-hidden />
      </button>
      {open ? (
        <div className="avatar-dropdown" role="menu">
          <div className="avatar-dropdown-header">
            <span className="avatar-dropdown-name">{user?.name || "User"}</span>
            <span className="avatar-dropdown-email">{user?.email}</span>
            {user?.phone ? (
              <span className="avatar-dropdown-phone">{user.phone}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="avatar-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/videos");
            }}
          >
            Videos
          </button>
          <button
            type="button"
            className="avatar-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/organization");
            }}
          >
            Organization
          </button>
          <button
            type="button"
            className="avatar-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
          >
            Settings
          </button>
          <button
            type="button"
            className="avatar-dropdown-logout"
            role="menuitem"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
