"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { AccountAvatar } from "./account-avatar";
import { accountError } from "@/lib/accounts/use-account";
import { accountApi, profileImageUrl, type AccountProfile, type ImageKind } from "@/lib/accounts/client";
import { cropImage, imageSettings, prepareImage } from "@/lib/accounts/images";

export function ProfileImageEditor({ kind, profile, trigger, request, onProfile, onClose, onMessage }: {
  kind: ImageKind;
  profile: AccountProfile;
  trigger: HTMLElement;
  request: <T>(send: (token: string) => Promise<T>) => Promise<T>;
  onProfile: (profile: AccountProfile) => void;
  onClose: () => void;
  onMessage: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settings = imageSettings[kind];
  const current = profileImageUrl(profile, kind);
  const isAvatar = kind === "avatar";

  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const src = await prepareImage(file, kind);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
      setSource(src);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to open this image.");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!source || !area) return;
    setBusy(true);
    setError("");
    try {
      const file = await cropImage(source, area, kind);
      const updated = await request(token => isAvatar ? accountApi.uploadAvatar(token, file) : accountApi.uploadBanner(token, file));
      onProfile(updated);
      onMessage(`${isAvatar ? "Avatar" : "Banner"} updated.`);
      onClose();
    } catch (error) {
      setError(error instanceof Error && !("status" in error) ? error.message : accountError(error));
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await request(token => accountApi.removeImage(token, kind));
      // DELETE has no response body. Clear immediately, then reconcile with the API.
      onProfile({ ...profile, [isAvatar ? "avatarUrl" : "bannerUrl"]: null });
      // A failed refresh must not report an already completed deletion as failed.
      const updated = await request(accountApi.getMe).catch(() => null);
      if (updated) onProfile(updated);
      onMessage(`${isAvatar ? "Avatar" : "Banner"} removed.`);
      onClose();
    } catch (error) { setError(accountError(error)); }
    finally { setBusy(false); }
  }

  return <Dialog.Root open onOpenChange={(open, details) => {
    if (busy) details.cancel();
    else if (!open) onClose();
  }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" />
      <Dialog.Popup finalFocus={() => trigger} className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-nook-surface shadow-xl outline-none">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <Dialog.Title className="text-base font-semibold">{isAvatar ? "Change Avatar" : "Edit Banner"}</Dialog.Title>
          <Dialog.Close disabled={busy} aria-label="Close image editor" className="grid size-10 place-items-center text-nook-text-secondary hover:bg-nook-surface-hover focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"><IconX size={20} /></Dialog.Close>
        </header>
        <div className="p-5 sm:p-6">
          <Dialog.Description className="mb-5 text-sm leading-6 text-nook-text-secondary">
            {source ? "Drag the image or use the arrow keys to position it. Adjust zoom, then save your crop." : `Choose a new ${kind}, or remove your current image.`}
          </Dialog.Description>
          {source ? <>
            <div aria-label={`Position ${kind} crop`} className={`relative overflow-hidden border border-border bg-black ${isAvatar ? "h-64 sm:h-80" : "h-56 sm:h-64"}`}>
              <Cropper image={source} crop={crop} zoom={zoom} aspect={settings.width / settings.height} cropShape={isAvatar ? "round" : "rect"} showGrid={!isAvatar} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} cropperProps={{ "aria-label": `Position ${kind} crop with arrow keys` }} keyboardStep={10} disableAutomaticStylesInjection />
            </div>
            <label className="mt-5 flex items-center gap-4 text-sm"><span>Zoom</span><input aria-label="Image zoom" type="range" min={1} max={3} step={0.01} value={zoom} onChange={event => setZoom(Number(event.target.value))} disabled={busy} className="min-w-0 flex-1 accent-primary" /><output className="w-12 text-right text-nook-text-muted">{zoom.toFixed(1)}×</output></label>
            <p className="mt-3 text-xs text-nook-text-muted">{isAvatar ? "Square crop · 256 × 256" : "3:1 crop · 1500 × 500"} · WebP</p>
          </> : isAvatar ? <div className="my-6 flex justify-center"><AccountAvatar profile={profile} size={160} className="border border-nook-control-border" /></div> : <div className="flex aspect-[3/1] items-center justify-center overflow-hidden border border-border bg-background">
            {current
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={current} alt="Current banner" className="size-full object-cover" referrerPolicy="no-referrer" />
              : <span className="flex items-center gap-2 text-sm text-nook-text-muted"><IconPhoto size={20} />No banner uploaded</span>}
          </div>}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Choose ${kind} image`} onChange={choose} disabled={busy} className="sr-only" tabIndex={-1} />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" size="lg" onClick={() => input.current?.click()} disabled={busy} className="min-h-11 px-4"><IconUpload />{source ? "Choose another image" : "Upload Image"}</Button>
            {!source && <Button type="button" variant="outline" size="lg" onClick={remove} disabled={busy || !current} className="min-h-11 px-4"><IconTrash />Remove {kind}</Button>}
          </div>
          <p className="mt-4 text-center text-xs leading-5 text-nook-text-muted">JPEG, PNG or WebP · max {isAvatar ? "1" : "5"} MiB · up to 20 megapixels</p>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-center text-xs text-nook-text-muted">{busy ? "Updating image…" : ""}</p>
        </div>
        {source && <footer className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <Dialog.Close render={<Button variant="outline" size="lg" disabled={busy} className="min-h-11 px-4" />}>Cancel</Dialog.Close>
          <Button type="button" size="lg" onClick={save} disabled={busy || !area} className="min-h-11 px-6">{busy ? "Saving…" : "Save"}</Button>
        </footer>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
