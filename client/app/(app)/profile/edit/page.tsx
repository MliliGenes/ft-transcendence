import type { Metadata } from "next";
import { ProfileEditor } from "@/components/app/profile-editor";

export const metadata: Metadata = { title: "Edit profile — Nook" };

export default function EditProfilePage() {
  return <ProfileEditor />;
}
