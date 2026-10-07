import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface MenuDialogProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  returnFocusId?: string;
}

/** Shared menu dialog: scroll-safe on short screens, with native focus containment. */
export function MenuDialog({
  title,
  description,
  onClose,
  children,
  wide,
  returnFocusId,
}: MenuDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      const focusTarget =
        (returnFocusId ? document.getElementById(returnFocusId) : null) ||
        previousFocus;
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      className={`bp-dialog ${wide ? "bp-dialog--wide" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          closeRef.current();
      }}
    >
      <div className="bp-dialog__content">
        <div className="bp-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            type="button"
            className="bp-icon-button"
            aria-label="Tutup dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
