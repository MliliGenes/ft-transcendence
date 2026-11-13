"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconCamera, IconCheck, IconPhoto } from "@tabler/icons-react";
import { AccountAvatar } from "@/components/app/account-avatar";
import { StatusComposer } from "@/components/app/status-composer";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropDialog } from "@/components/app/image-crop-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { currentAccountQueryKey, useCurrentAccount } from "@/hooks/use-current-account";
import { accountApi, type AccountUpdate, type UserAccount } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";

type ImageKind = "avatar" | "banner";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save your changes. Please try again.";
}

function ImagePreview({ source, alt, isAvatar = false, seed = "" }: { source: string | null; alt: string; isAvatar?: boolean; seed?: string }) {
  return (
    <div className={`relative overflow-hidden border border-border bg-muted ${isAvatar ? "size-24" : "h-44 w-full"}`}>
      {isAvatar ? <AccountAvatar source={source} seed={seed} label={alt} size={96} className="size-full object-cover" /> : source ? <Image src={source} alt={alt} fill sizes="(max-width: 768px) 100vw, 900px" unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center text-muted-foreground"><IconPhoto size={26} aria-hidden="true" /></span>}
    </div>
  );
}

function currentValues(account: UserAccount): AccountUpdate {
  return {
    username: account.username,
    email: account.email,
    firstName: account.firstName ?? "",
    lastName: account.lastName ?? "",
    displayName: account.displayName ?? "",
    bio: account.bio ?? "",
    statusText: account.statusText ?? "",
    statusIcon: account.statusIcon ?? null,
  };
}

export function ProfileEditor() {
  const { session, isRestoring, requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const account = useCurrentAccount();
  const [values, setValues] = useState<AccountUpdate | null>(null);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ kind: ImageKind; file: File } | null>(null);
  const key = currentAccountQueryKey(session?.user.id);

  const update = useMutation({
    mutationFn: (changes: AccountUpdate) => requestWithSession(token => accountApi.updateMe(token, changes)),
    onSuccess: updated => {
      queryClient.setQueryData(key, updated);
      setValues(currentValues(updated));
      setFormError("");
      setFormNotice("Profile saved.");
    },
    onError: error => setFormError(getErrorMessage(error)),
  });

  const imageMutation = useMutation({
    mutationFn: ({ kind, file }: { kind: ImageKind; file: File }) => requestWithSession(token => accountApi.uploadImage(token, kind, file)),
    onSuccess: updated => {
      queryClient.setQueryData(key, updated);
      setSelectedImage(null);
      setFormNotice("Image updated.");
    },
    onError: error => setFormError(getErrorMessage(error)),
  });

  const removeImage = useMutation({
    mutationFn: (kind: ImageKind) => requestWithSession(token => accountApi.removeImage(token, kind).then(() => kind)),
    onSuccess: kind => {
      queryClient.setQueryData(key, (current: UserAccount | undefined) => current
        ? { ...current, [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: null }
        : current);
      setFormNotice("Image removed.");
    },
    onError: error => setFormError(getErrorMessage(error)),
  });

  if (isRestoring) return <div role="status" className="mx-auto w-full max-w-4xl p-6 text-sm text-muted-foreground">Loading your profile…</div>;
  if (!session) return <div className="mx-auto w-full max-w-4xl p-6 text-sm text-muted-foreground">Log in to edit your profile. <a href="/login" className={cn(buttonVariants(), "ml-3 min-h-11")}>Log in</a></div>;
  if (account.isPending) return <div role="status" className="mx-auto w-full max-w-4xl p-6 text-sm text-muted-foreground">Loading your profile…</div>;
  if (account.error || !account.data) return <div role="alert" className="mx-auto w-full max-w-4xl p-6 text-sm text-destructive">Unable to load your profile. <Button variant="outline" onClick={() => account.refetch()} className="ml-3">Try again</Button></div>;

  const user = account.data;
  const formValues = values ?? currentValues(user);
  const avatarSource = accountImageSource(user.avatarUrl);
  const bannerSource = accountImageSource(user.bannerUrl);
  const busyImage = imageMutation.isPending || removeImage.isPending;

  function updateField(field: keyof AccountUpdate, value: string) {
    setValues(current => ({ ...currentValues(user), ...current, [field]: value }));
    setFormError("");
    setFormNotice("");
  }

  function handleImageSelection(kind: ImageKind, file?: File) {
    setFormError("");
    if (!file) return;
    const maxSize = kind === "avatar" ? 1024 * 1024 : 5 * 1024 * 1024;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setFormError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > maxSize) {
      setFormError(`Choose an image under ${kind === "avatar" ? "1 MiB" : "5 MiB"}.`);
      return;
    }
    setSelectedImage({ kind, file });
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changes: AccountUpdate = {};
    for (const field of ["username", "email", "firstName", "lastName", "displayName", "bio", "statusText", "statusIcon"] as const) {
      const value = String(formValues[field] ?? "").trim();
      const original = String(currentValues(user)[field] ?? "");
      if (value === original) continue;
      if (field === "firstName" || field === "lastName" || field === "displayName" || field === "bio" || field === "statusText" || field === "statusIcon") {
        changes[field] = value || null;
      } else {
        changes[field] = value;
      }
    }
    if (!Object.keys(changes).length) return;
    if (changes.username !== undefined && (changes.username.length < 3 || changes.username.length > 30)) {
      setFormError("Username must be between 3 and 30 characters.");
      return;
    }
    if (changes.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (changes.displayName && changes.displayName.length > 50 || changes.firstName && changes.firstName.length > 50 || changes.lastName && changes.lastName.length > 50) {
      setFormError("Names must be 50 characters or fewer.");
      return;
    }
    if (changes.bio && changes.bio.length > 190) {
      setFormError("Bio must be 190 characters or fewer.");
      return;
    }
    if (changes.statusText && changes.statusText.length > 100) {
      setFormError("Status must be 100 characters or fewer.");
      return;
    }
    update.mutate(changes);
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-12" aria-labelledby="profile-title">
      <header className="mb-8">
        <Link href="/profile" className={cn(buttonVariants({ variant: "outline" }), "mb-5 min-h-11")}>View profile</Link>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Make it yours</p>
        <h1 id="profile-title" className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Edit profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Update the details people see around Nook.</p>
      </header>

      <div className="mb-8 grid gap-5">
        <article className="overflow-hidden border border-border bg-card">
          <div className="relative">
            <ImagePreview source={bannerSource} alt="Profile banner" />
            <label className="absolute right-3 top-3 inline-flex min-h-11 cursor-pointer items-center gap-2 border border-border bg-background/95 px-4 text-sm font-medium hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
              <IconCamera size={17} aria-hidden="true" /> Change banner
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { handleImageSelection("banner", event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
            </label>
            {user.bannerUrl && <Button variant="outline" disabled={busyImage} onClick={() => removeImage.mutate("banner")} className="absolute bottom-3 right-3 min-h-10 bg-background/95">Remove</Button>}
          </div>
          <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
            <div className="-mt-12 border-4 border-card bg-card p-0.5"><ImagePreview source={avatarSource} alt={`${user.displayName || user.username}'s avatar`} seed={user.id} isAvatar /></div>
            <div className="flex flex-wrap gap-3 pb-1">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-border bg-background px-4 text-sm font-medium hover:bg-muted focus-within:outline-2 focus-within:outline-ring">
                <IconCamera size={17} aria-hidden="true" /> Change avatar
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { handleImageSelection("avatar", event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              {user.avatarUrl && <Button variant="outline" disabled={busyImage} onClick={() => removeImage.mutate("avatar")} className="min-h-11">Remove avatar</Button>}
            </div>
          </div>
        </article>
      </div>

      <form onSubmit={saveProfile} className="border border-border bg-card p-5 md:p-7">
        {formError && <p role="alert" className="mb-5 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</p>}
        {formNotice && <p role="status" className="mb-5 text-sm text-nook-success">{formNotice}</p>}
        <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="displayName">Display name</Label><Input id="displayName" value={formValues.displayName ?? ""} maxLength={50} onChange={event => updateField("displayName", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" required minLength={3} maxLength={30} autoCapitalize="none" autoComplete="username" value={formValues.username ?? ""} onChange={event => updateField("username", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" maxLength={50} value={formValues.firstName ?? ""} onChange={event => updateField("firstName", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" maxLength={50} value={formValues.lastName ?? ""} onChange={event => updateField("lastName", event.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="email">Email</Label><div className="flex flex-wrap items-center gap-3"><Input id="email" type="email" required autoComplete="email" value={formValues.email ?? ""} onChange={event => updateField("email", event.target.value)} className="min-w-56 flex-1" /><span className={`inline-flex min-h-8 items-center gap-1.5 text-xs ${user.emailVerifiedAt ? "text-nook-success" : "text-muted-foreground"}`}><IconCheck size={15} aria-hidden="true" />{user.emailVerifiedAt ? "Verified" : "Not verified"}</span></div><p className="text-xs text-muted-foreground">Changing your email clears its verified status.</p></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" maxLength={190} rows={3} value={formValues.bio ?? ""} onChange={event => updateField("bio", event.target.value)} /><p className="text-right text-xs text-muted-foreground">{String(formValues.bio ?? "").length}/190</p></div>
          <StatusComposer
            text={formValues.statusText ?? ""}
            icon={formValues.statusIcon ?? ""}
            onTextChange={value => updateField("statusText", value)}
            onIconChange={value => updateField("statusIcon", value)}
          />
        </div>
        <div className="mt-7 flex justify-end"><Button type="submit" disabled={update.isPending} className="min-h-11 gap-2 px-5">{update.isPending ? "Saving…" : "Save changes"}</Button></div>
      </form>

      {selectedImage && <ImageCropDialog kind={selectedImage.kind} file={selectedImage.file} open pending={imageMutation.isPending} onOpenChange={open => { if (!open) setSelectedImage(null); }} onSave={file => imageMutation.mutateAsync({ kind: selectedImage.kind, file }).then(() => undefined)} />}
    </section>
  );
}
