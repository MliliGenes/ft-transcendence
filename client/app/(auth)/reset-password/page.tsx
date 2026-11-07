import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/password-recovery-forms";

export const metadata: Metadata = { title: "Reset password — Nook" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
