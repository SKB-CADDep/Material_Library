import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export type TruncatedTextProps = {
  value: string;
  className?: string;
  tooltip?: string;
  tooltipContent?: ReactNode;
  emptyPlaceholder?: string;
  href?: string;
  target?: string;
  rel?: string;
};

export function TruncatedText({
  value,
  className,
  tooltip,
  tooltipContent,
  emptyPlaceholder = "—",
  href,
  target,
  rel,
}: TruncatedTextProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const text = value.trim();
  const tooltipText = (tooltip ?? text).trim();
  const isLink = Boolean(href);
  const resolvedTooltip = tooltipContent ?? tooltipText;
  const forceTooltip = Boolean(tooltip && tooltip.trim() !== text);

  const checkOverflow = () => {
    const el = textRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollWidth > el.clientWidth + 1);
  };

  useEffect(() => {
    checkOverflow();
    const el = textRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => checkOverflow());
    observer.observe(el);
    if (el.parentElement) {
      observer.observe(el.parentElement);
    }

    return () => observer.disconnect();
  }, [text]);

  useEffect(() => {
    if (!showTooltip) return;

    const handleUpdate = () => {
      const rect = cellRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
      }
    };

    handleUpdate();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [showTooltip]);

  if (!text) {
    return <span className="empty-value">{emptyPlaceholder}</span>;
  }

  const handleMouseEnter = () => {
    if (!forceTooltip && !isOverflowing) return;
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  const rootClassName = ["truncated-cell", className].filter(Boolean).join(" ");
  const tooltipNode =
    showTooltip && (forceTooltip || isOverflowing)
      ? createPortal(
          <div
            className={[
              "truncated-tooltip",
              tooltipContent ? "truncated-tooltip--rich" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="tooltip"
            style={{
              top: position.top,
              left: position.left,
              transform: "translateX(-50%) translateY(-100%)",
            }}
          >
            {resolvedTooltip}
          </div>,
          document.body,
        )
      : null;

  const content = (
    <span ref={textRef} className="truncated-text">
      {text}
    </span>
  );

  if (isLink) {
    return (
      <>
        <a
          ref={cellRef as RefObject<HTMLAnchorElement>}
          href={href}
          target={target}
          rel={rel}
          className={rootClassName}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {content}
        </a>
        {tooltipNode}
      </>
    );
  }

  return (
    <>
      <span
        ref={cellRef as RefObject<HTMLSpanElement>}
        className={rootClassName}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </span>
      {tooltipNode}
    </>
  );
}
