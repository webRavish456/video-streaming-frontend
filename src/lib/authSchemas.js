import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name is too long"),
    email: z
      .string()
      .trim()
      .min(1, "Email is required")
      .max(254, "Email is too long")
      .email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .min(1, "Phone number is required")
      .refine((s) => digitsOnly(s).length === 10, {
        message: "Phone number must be exactly 10 digits",
      }),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    organizationName: z
      .string()
      .trim()
      .min(2, "Organization name must be at least 2 characters")
      .max(120, "Organization name is too long"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, "Email or phone is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .superRefine((data, ctx) => {
    const raw = data.identifier;
    if (raw.includes("@")) {
      if (!emailRegex.test(raw)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid email address",
          path: ["identifier"],
        });
      }
      return;
    }
    const d = digitsOnly(raw);
    if (d.length !== 10) {
      ctx.addIssue({
        code: "custom",
        message: "Phone number must be exactly 10 digits",
        path: ["identifier"],
      });
    }
  });
