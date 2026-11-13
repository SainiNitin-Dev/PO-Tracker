"use client";
import { useEffect, useRef } from "react";
export type Confirmation = {
  title: string;
  description: string;
  label: string;
  onConfirm: () => void;
};
export default function ConfirmDialog({
  confirmation,
  onClose,
}: {
  confirmation: Confirmation | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation && !ref.current?.open) ref.current?.showModal();
    if (!confirmation) ref.current?.close();
  }, [confirmation]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-description"
    >
      <h2 id="confirmation-title" className="text-xl font-semibold">
        {confirmation?.title}
      </h2>
      <p
        id="confirmation-description"
        className="muted mt-3 text-sm leading-relaxed"
      >
        {confirmation?.description}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button autoFocus className="secondary-action" onClick={onClose}>
          Keep it
        </button>
        <button
          className="danger-action"
          onClick={() => {
            const action = confirmation?.onConfirm;
            onClose();
            action?.();
          }}
        >
          {confirmation?.label}
        </button>
      </div>
    </dialog>
  );
}
