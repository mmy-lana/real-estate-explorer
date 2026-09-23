import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap, useScrollLock } from "../../hooks/useFocusTrap";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky action row rendered below the scrollable body. */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Clicking the backdrop dismisses the dialog. Defaults to `true`. */
  closeOnBackdrop?: boolean;
  /** Hides the header close button (the caller must supply another exit). */
  hideCloseButton?: boolean;
  /** Element focused when the dialog opens. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  labelledBy?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Focus-trapped modal dialog rendered through a portal. Implements
 * `aria-modal="true"`, `role="dialog"`, Escape dismissal, backdrop blur, body
 * scroll locking, and focus restoration to the trigger element.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  hideCloseButton = false,
  initialFocusRef,
  labelledBy,
  className,
}: ModalProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = labelledBy ?? "modal-title";
  const descriptionId = description ? "modal-description" : undefined;

  useFocusTrap(dialogRef, { active: isOpen, onEscape: onClose, initialFocusRef });
  useScrollLock(isOpen);

  // Keep the dialog anchored to the top of the viewport when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      if (dialogRef.current) dialogRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={descriptionId}
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-panel",
          "animate-rise-in rounded-t-3xl sm:rounded-3xl",
          SIZE_CLASSES[size],
          className,
        )}
      >
        {title || !hideCloseButton ? (
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="truncate text-base font-semibold text-ink">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                  {description}
                </p>
              ) : null}
            </div>

            {hideCloseButton ? null : (
              <Button
                variant="circle"
                size="sm"
                onClick={onClose}
                label="Close dialog"
                className="-mt-1 -mr-1 border-transparent bg-transparent hover:bg-surface-alt"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </header>
        ) : null}

        <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer ? (
          <footer className="border-t border-line bg-surface px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
