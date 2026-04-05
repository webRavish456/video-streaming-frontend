"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { loginSchema } from "@/lib/authSchemas";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready, login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const justRegistered = searchParams.get("registered") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
    mode: "onBlur",
  });

  useEffect(() => {
    if (ready && user) {
      router.replace("/");
    }
  }, [ready, user, router]);

  const onSubmit = async (data) => {
    setError("");
    setLoading(true);
    try {
      await login(data.identifier.trim(), data.password);
      router.replace("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!ready || user) {
    return (
      <div className="auth-loading-screen" aria-busy="true">
        <span className="auth-loading-dot" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-brand">
          <span className="logo-icon logo-icon--sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          StreamHub
        </Link>
        <h1 className="auth-title">Log in</h1>
        <p className="auth-subtitle">Use your email or phone number and password.</p>

        {justRegistered ? (
          <div className="auth-info" role="status">
            Account created. Log in to open the home page.
          </div>
        ) : null}

        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="auth-label">
            Email or phone number
            <input
              className={`auth-input${errors.identifier ? " auth-input--error" : ""}`}
              type="text"
              autoComplete="username"
              placeholder="you@example.com or 10-digit phone"
              aria-invalid={errors.identifier ? "true" : "false"}
              {...register("identifier")}
            />
            {errors.identifier ? (
              <span className="auth-field-error" role="alert">
                {errors.identifier.message}
              </span>
            ) : null}
          </label>

          <label className="auth-label">
            Password
            <input
              className={`auth-input${errors.password ? " auth-input--error" : ""}`}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : "false"}
              {...register("password")}
            />
            {errors.password ? (
              <span className="auth-field-error" role="alert">
                {errors.password.message}
              </span>
            ) : null}
          </label>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="auth-footer">
          New here?{" "}
          <Link href="/signup" className="auth-link">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-loading-screen" aria-busy="true">
          <span className="auth-loading-dot" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
