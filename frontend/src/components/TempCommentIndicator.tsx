import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TempCommentIndicatorProps = {
  comment: string;
  ariaLabel?: string;
  className?: string;
};

type TooltipPosition = {
  top: number;
  left: number;
  placeAbove: boolean;
};

function tooltipPosition(trigger: HTMLElement): TooltipPosition {
  const rect = trigger.getBoundingClientRect();
  const maxWidth = 260;
  const estimatedHeight = 88;
  const gap = 8;
  const placeAbove =
    rect.bottom + gap + estimatedHeight > window.innerHeight &&
    rect.top > estimatedHeight + gap;
  const top = placeAbove ? rect.top - gap : rect.bottom + gap;
  const half = maxWidth / 2;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2, half + 8),
    window.innerWidth - half - 8,
  );
  return { top, left, placeAbove };
}

export function TempCommentIndicator({
  comment,
  ariaLabel = "Есть комментарий к температуре применения",
  className,
}: TempCommentIndicatorProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      setPosition(tooltipPosition(trigger));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const tooltip =
    open && position
      ? createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className={[
              "temp-comment-tooltip",
              "temp-comment-tooltip--portal",
              position.placeAbove
                ? "temp-comment-tooltip--above"
                : "temp-comment-tooltip--below",
            ].join(" ")}
            style={{ top: position.top, left: position.left }}
          >
            {comment}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={["temp-comment-indicator", className].filter(Boolean).join(" ")}
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <svg
          className="temp-comment-icon"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          aria-hidden="true"
        >
          <circle
            cx="7"
            cy="7"
            r="6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <circle cx="7" cy="4.5" r="0.85" fill="currentColor" />
          <path
            d="M7 6.5v3.25"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {tooltip}
    </>
  );
}
