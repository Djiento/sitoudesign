"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { LoaderCircle, Trash2 } from "lucide-react";

export default function AdminConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-dialog-overlay" />
        <Dialog.Content className="admin-confirm-dialog">
          <span className="admin-confirm-icon"><Trash2 size={20} /></span>
          <Dialog.Title className="admin-dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="admin-dialog-description">{description}</Dialog.Description>
          <div className="admin-form-actions">
            <Dialog.Close asChild>
              <button type="button" className="admin-quiet-button" disabled={busy}>{cancelLabel}</button>
            </Dialog.Close>
            <button type="button" className="admin-danger-button" onClick={onConfirm} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Trash2 size={16} />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
