import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type SelectionCellContextMenuProps = {
  x: number;
  y: number;
  onCopy: () => void;
  onClose: () => void;
};

function CopyIcon() {
  return (
    <svg
      className="selection-cell-context-menu__icon-svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="5"
        width="8"
        height="9"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M4 11V3.75C4 2.784 4.784 2 5.75 2H11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SelectionCellContextMenu({
  x,
  y,
  onCopy,
  onClose,
}: SelectionCellContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className="selection-cell-context-menu"
      role="menu"
      aria-label="Действия с ячейкой"
      style={{ top: y, left: x }}
    >
      <ul className="selection-cell-context-menu__list">
        <li>
          <button
            type="button"
            role="menuitem"
            className="selection-cell-context-menu__item"
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            <span className="selection-cell-context-menu__icon">
              <CopyIcon />
            </span>
            <span className="selection-cell-context-menu__label">Копировать</span>
          </button>
        </li>
      </ul>
    </div>,
    document.body,
  );
}
