import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { unitDisplayText } from "../lib/columnUnits";

type ColumnUnitContextMenuProps = {
  x: number;
  y: number;
  columnLabel: string;
  units: string[];
  currentUnit: string;
  displayLabels?: Record<string, string>;
  onSelect: (unit: string) => void;
  onClose: () => void;
};

export function ColumnUnitContextMenu({
  x,
  y,
  columnLabel,
  units,
  currentUnit,
  displayLabels,
  onSelect,
  onClose,
}: ColumnUnitContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

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
      id={menuId}
      className="column-unit-context-menu"
      role="menu"
      aria-label={`Единицы измерения: ${columnLabel}`}
      style={{ top: y, left: x }}
    >
      <div className="column-unit-context-menu__title">{columnLabel}</div>
      <ul className="column-unit-context-menu__list">
        {units.map((unit) => {
          const label = unitDisplayText(unit, displayLabels);
          const isActive = unit === currentUnit;

          return (
            <li key={unit}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={[
                  "column-unit-context-menu__item",
                  isActive ? "column-unit-context-menu__item--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  onSelect(unit);
                  onClose();
                }}
              >
                <span className="column-unit-context-menu__marker" aria-hidden>
                  {isActive ? "●" : "○"}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
