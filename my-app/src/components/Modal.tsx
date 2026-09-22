import { useEffect } from "react";
import { createPortal } from "react-dom";

// Plain, fully React-controlled modal - deliberately NOT using Materialize's
// M.Modal. That library keeps state outside React entirely: a single global
// static counter (Modal._modalsOpen) shared across every modal instance on
// the page, plus a DOM overlay div it inserts/removes itself via imperative
// JS animation callbacks. Any mismatch between React's render lifecycle and
// that external state (an interrupted close animation, an unmount racing an
// open, Vite HMR swapping the module without resetting already-corrupted
// page state) can leave the counter stuck above 0 or an invisible overlay
// orphaned in the DOM forever - silently blocking every click with an empty
// console, and unrecoverable without a full page reload. Rendering the
// overlay via React (open ? <portal> : null) means React itself guarantees
// the overlay is removed exactly when `open` becomes false - there's no
// external state to fall out of sync with.
//
// Also deliberately does NOT carry Materialize's "modal"/"modal-content"/
// "modal-footer" classNames - those only get their padding/spacing from
// Materialize's own CSS, which is scoped as ".modal .modal-content" (a
// descendant selector requiring an ancestor with the literal ".modal" class,
// which also carries `display: none` until Materialize's own JS toggles it -
// exactly what this component replaces). Content/footer spacing here is
// self-contained instead.
let openModalCount = 0;

export default function Modal({
  open,
  onClose,
  children,
  footer,
  dismissible = true,
  maxWidth = 720,
  zIndex = 9999,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dismissible?: boolean;
  maxWidth?: number | string;
  zIndex?: number;
}) {
  useEffect(() => {
    if (!open) return;
    openModalCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        zIndex,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        // clamp() over fixed breakpoints so this scales continuously down to
        // very narrow/fold-style screens (~280-320px) without ever leaving
        // dead, unusable margin on tiny viewports.
        padding: "clamp(0px, 4vw, 40px) clamp(0px, 3vw, 16px)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth,
          boxShadow: "0 20px 60px rgba(15,23,42,.35)",
          maxHeight: "calc(100vh - clamp(0px, 8vw, 80px))",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            padding: "clamp(14px, 4vw, 24px)",
            overflowY: "auto",
            minHeight: 0,
          }}
        >
          {children}
        </div>

        {footer ? (
          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
              padding: "12px clamp(14px, 4vw, 24px)",
              borderTop: "1px solid rgba(15,23,42,.08)",
              background: "#fafafa",
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
