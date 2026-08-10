"use client";

import { Card } from "./Card";
import { Button } from "./Button";

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-sm animate-pop-in p-6">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
