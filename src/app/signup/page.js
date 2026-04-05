"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/context/AuthContext";
import { digitsOnly, signupSchema } from "@/lib/authSchemas";

export default function SignupPage() {
  const router = useRouter();
  const { user, ready, register: registerUser } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      organizationName: "",
    },
    mode: "onBlur",
  });

  const passwordValue = watch("password");
  useEffect(() => {
    if (getValues("confirmPassword")) {
      void trigger("confirmPassword");
    }
  }, [passwordValue, trigger, getValues]);

  useEffect(() => {
    if (ready && user) {
      router.replace("/");
    }
  }, [ready, user, router]);

  const onSubmit = async (data) => {
    setError("");
    setLoading(true);
    try {
      const phone = digitsOnly(data.phone);
      await registerUser(
        data.name.trim(),
        data.email.trim(),
        phone,
        data.password,
        data.organizationName.trim()
      );
      router.replace("/login");
    } catch (err) {
      setError(err.message || "Sign up failed");
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
        <h1 className="auth-title">Sign up</h1>

        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="auth-label">
            Name
            <input
              className={`auth-input${errors.name ? " auth-input--error" : ""}`}
              type="text"
              autoComplete="name"
              aria-invalid={errors.name ? "true" : "false"}
              {...register("name")}
            />
            {errors.name ? (
              <span className="auth-field-error" role="alert">
                {errors.name.message}
              </span>
            ) : null}
          </label>

          <label className="auth-label">
            Email
            <input
              className={`auth-input${errors.email ? " auth-input--error" : ""}`}
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={errors.email ? "true" : "false"}
              {...register("email")}
            />
            {errors.email ? (
              <span className="auth-field-error" role="alert">
                {errors.email.message}
              </span>
            ) : null}
          </label>

          <label className="auth-label">
            Phone number
            <input
              className={`auth-input${errors.phone ? " auth-input--error" : ""}`}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="10 digits, e.g. 9876543210"
              aria-invalid={errors.phone ? "true" : "false"}
              {...register("phone")}
            />
            {errors.phone ? (
              <span className="auth-field-error" role="alert">
                {errors.phone.message}
              </span>
            ) : null}
          </label>

          <label className="auth-label">
            Organization name
            <input
              className={`auth-input${errors.organizationName ? " auth-input--error" : ""}`}
              type="text"
              autoComplete="organization"
              aria-invalid={errors.organizationName ? "true" : "false"}
              {...register("organizationName")}
            />
            {errors.organizationName ? (
              <span className="auth-field-error" role="alert">
                {errors.organizationName.message}
              </span>
            ) : null}
          </label>

          <label className="auth-label">
            Password
            <input
              className={`auth-input${errors.password ? " auth-input--error" : ""}`}
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : "false"}
              {...register("password")}
            />
            {errors.password ? (
              <span className="auth-field-error" role="alert">
                {errors.password.message}
              </span>
            ) : null}
          </label>

          <label className="auth-label">
            Confirm password
            <input
              className={`auth-input${errors.confirmPassword ? " auth-input--error" : ""}`}
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <span className="auth-field-error" role="alert">
                {errors.confirmPassword.message}
              </span>
            ) : null}
          </label>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link href="/login" className="auth-link">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
