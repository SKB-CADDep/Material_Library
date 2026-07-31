type AcceptanceIndicatorProps = {
  className?: string;
};

export function AcceptanceIndicator({ className }: AcceptanceIndicatorProps) {
  return (
    <span
      className={[
        "acceptance-indicator",
        "temp-comment-indicator",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={0}
      aria-label="Сдаточная характеристика"
    >
      <span className="acceptance-indicator__mark" aria-hidden="true">
        сд
      </span>
      <span className="temp-comment-tooltip" role="tooltip">
        Сдаточная характеристика
      </span>
    </span>
  );
}
