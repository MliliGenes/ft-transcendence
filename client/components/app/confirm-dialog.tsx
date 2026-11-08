"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, pendingLabel, pending = false, destructive = false, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogPopup className="max-w-md">
      <div className="pr-8">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">{description}</DialogDescription>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="min-h-11 px-4" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant={destructive ? "destructive" : "default"} className="min-h-11 px-4" disabled={pending} onClick={onConfirm}>{pending ? pendingLabel ?? confirmLabel : confirmLabel}</Button>
      </div>
    </DialogPopup>
  </Dialog>;
}
