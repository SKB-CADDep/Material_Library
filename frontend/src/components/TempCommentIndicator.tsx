type TempCommentIndicatorProps = {
  comment: string;
  ariaLabel?: string;
  className?: string;
};

export function TempCommentIndicator({
  comment,
  ariaLabel = "Есть комментарий к температуре применения",
  className,
}: TempCommentIndicatorProps) {
  return (
    <span
      className={["temp-comment-indicator", className].filter(Boolean).join(" ")}
      tabIndex={0}
      aria-label={ariaLabel}
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
      <span className="temp-comment-tooltip" role="tooltip">
        {comment}
      </span>
    </span>
  );
}
