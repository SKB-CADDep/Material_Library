import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SingleCalculationColumn, UnitResponse } from "../types/api";
import { calculationColumnMenuLabel } from "../lib/calculationColumnHeader";
import { ScientificText } from "../lib/scientificNotation";
import {
  filterVisibleColumns,
  setAllColumnVisibility,
  toggleColumnVisibility,
} from "../lib/columnVisibility";

type PanelPosition = {
  top: number;
  left: number;
  minWidth: number;
};

type CalculationColumnMenuProps = {
  columns: SingleCalculationColumn[];
  visibility: Record<string, boolean>;
  columnUnits?: Record<string, string>;
  unitConfigs?: Record<string, UnitResponse>;
  onChange: (next: Record<string, boolean>) => void;
  disabled?: boolean;
};

export function CalculationColumnMenu({
  columns,
  visibility,
  columnUnits = {},
  unitConfigs = {},
  onChange,
  disabled = false,
}: CalculationColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const visibleCount = filterVisibleColumns(columns, visibility).length;

  useEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPanelPosition({
        top: rect.bottom + 4,
        left: rect.left,
        minWidth: Math.max(rect.width, 280),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const panel =
    open && panelPosition
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className="calculation-column-menu-panel"
            role="dialog"
            aria-label="Настройка столбцов таблицы"
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              minWidth: panelPosition.minWidth,
            }}
          >
            <div className="calculation-column-menu-actions">
              <button
                type="button"
                className="calculation-column-menu-action"
                onClick={() =>
                  onChange(setAllColumnVisibility(columns, true))
                }
              >
                Показать все
              </button>
              <button
                type="button"
                className="calculation-column-menu-action"
                onClick={() =>
                  onChange(setAllColumnVisibility(columns, false))
                }
              >
                Скрыть все
              </button>
            </div>
            <div className="checkbox-list calculation-column-menu-list">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className="checkbox-item calculation-column-menu-item"
                >
                  <input
                    type="checkbox"
                    checked={visibility[col.key] !== false}
                    onChange={() =>
                      onChange(toggleColumnVisibility(visibility, col.key))
                    }
                  />{" "}
                  <ScientificText>
                    {calculationColumnMenuLabel(
                      col,
                      columnUnits[col.key] ?? col.unit,
                      col.unit_type ? unitConfigs[col.unit_type] : undefined,
                    )}
                  </ScientificText>
                </label>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="calculation-column-menu">
      <button
        ref={triggerRef}
        type="button"
        className={[
          "input",
          "area-filter-trigger",
          "calculation-column-menu-trigger",
          open ? "calculation-column-menu-trigger--open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled || columns.length === 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="calculation-column-menu-trigger__content">
          <span className="area-filter-trigger-label">Настроить столбцы</span>
          {columns.length > 0 && (
            <span className="calculation-column-menu-trigger__badge">
              {visibleCount}/{columns.length}
            </span>
          )}
        </span>
        <span className="area-filter-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}
