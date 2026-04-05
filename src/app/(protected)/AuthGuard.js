"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  if (!ready) {
    return (
      <div className="auth-loading-screen" aria-busy="true" aria-live="polite">
        <span className="auth-loading-dot" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}
