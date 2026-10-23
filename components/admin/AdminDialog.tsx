"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-dialog-overlay" />
        <Dialog.Content className={`admin-dialog-content${className ? ` ${className}` : ""}`}>
          <div className="admin-dialog-heading">
            <div>
              <Dialog.Title className="admin-dialog-title">{title}</Dialog.Title>
              {description && <Dialog.Description className="admin-dialog-description">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="admin-icon-button" aria-label={closeLabel}>
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
