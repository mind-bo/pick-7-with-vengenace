import type { ComponentChildren } from "preact";

export const NOTICE = "Unofficial fan tool. Not made by The Op Games.";

export function Notice() {
  return <p class="notice">{NOTICE}</p>;
}

interface ConfirmProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div class="modal-bg">
      <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
        <b>{title}</b>
        <p>{body}</p>
        <div class="row">
          <button onClick={onCancel}>Cancel</button>
          <button class="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Screen({ children }: { children: ComponentChildren }) {
  return <div class="screen">{children}</div>;
}
