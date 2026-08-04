declare const M: any;

function isVisibleElement(el: Element | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const cs = window.getComputedStyle(el);
  if (cs.display === "none") return false;
  if (cs.visibility === "hidden") return false;
  if (Number(cs.opacity || "1") <= 0.01) return false;
  return true;
}

export function syncMaterializeModalState() {
  if (typeof document === "undefined") return;

  const hasOpenModal = Array.from(document.querySelectorAll(".modal")).some(
    (el) => el.classList.contains("open") || isVisibleElement(el)
  );

  if (hasOpenModal) return;

  document.querySelectorAll(".modal-overlay").forEach((el) => el.remove());
  document.body.classList.remove("modal-open");
  if (document.body.style.overflow === "hidden") document.body.style.overflow = "";
  if (document.body.style.paddingRight) document.body.style.paddingRight = "";
}

export function getMaterializeModalInstance(ref: HTMLDivElement | null) {
  if (!ref || typeof M === "undefined") return null;
  return M.Modal.getInstance(ref) || M.Modal.init(ref);
}

export function closeMaterializeModal(
  instance: any,
  onFallbackClose?: () => void
) {
  if (!instance) {
    onFallbackClose?.();
    syncMaterializeModalState();
    return;
  }

  try {
    instance.close();
  } catch {
    onFallbackClose?.();
    syncMaterializeModalState();
  }
}
