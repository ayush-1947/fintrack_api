// src/services/auth/application/dtos/auth.dto.ts
import { z } from 'zod';

// ─── Signup ───────────────────────────────────────────────────────────────────
export const SignupDto = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1).max(50).trim(),
  lastName:  z.string().min(1).max(50).trim(),
});
export type SignupDto = z.infer<typeof SignupDto>;

// ─── Login ────────────────────────────────────────────────────────────────────
export const LoginDto = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginDto>;

// ─── Refresh Token ────────────────────────────────────────────────────────────
export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>;

// ─── Verify Email ─────────────────────────────────────────────────────────────
export const VerifyEmailDto = z.object({
  token: z.string().min(1),
});
export type VerifyEmailDto = z.infer<typeof VerifyEmailDto>;

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const ForgotPasswordDto = z.object({
  email: z.string().email().toLowerCase().trim(),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordDto>;

// ─── Reset Password ───────────────────────────────────────────────────────────
export const ResetPasswordDto = z.object({
  token:    z.string().min(1),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordDto>;

// ─── Response shapes ──────────────────────────────────────────────────────────
export interface AuthTokensResponse {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

export interface SignupResponse {
  user: {
    id:        string;
    email:     string;
    firstName: string;
    lastName:  string;
    role:      string;
  };
  message: string;
}
