import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Register — Nook" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
