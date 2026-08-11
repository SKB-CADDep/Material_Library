import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getUnits } from "../api/units";
import { ScientificText } from "../lib/scientificNotation";

type UnitSelectProps = {
  id: string;
  unitType: string;
  value: string;
  onChange: (nextUnit: string) => void;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

export function UnitSelect({ id, unitType, value, onChange }: UnitSelectProps) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const unitsQuery = useQuery({
    queryKey: ["units", unitType],
    queryFn: () => getUnits(unitType),
    enabled: unitType.length > 0,
  });

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
        width: rect.width,
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

  if (unitsQuery.isLoading || unitType.length === 0) {
    return (
      <button
        id={id}
        type="button"
        className="input unit-select-trigger"
        disabled
      />
    );
  }

  if (unitsQuery.isError) {
    return (
      <button
        id={id}
        type="button"
        className="input unit-select-trigger"
        disabled
      >
        Ошибка загрузки единиц
      </button>
    );
  }

  const units = unitsQuery.data?.units ?? [];
  const labels = unitsQuery.data?.display_labels ?? {};
  const selected =
    value && units.includes(value)
      ? value
      : (unitsQuery.data?.system_unit ?? "");
  const selectedLabel = labels[selected] ?? selected;

  const panel =
    open && panelPosition ? (
      <div
        ref={panelRef}
        id={listboxId}
        className="unit-select-panel unit-select-panel--portal"
        role="listbox"
        aria-labelledby={id}
        style={{
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelPosition.width,
        }}
      >
        {units.map((unit) => {
          const label = labels[unit] ?? unit;
          const isSelected = unit === selected;

          return (
            <button
              key={unit}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={[
                "unit-select-option",
                isSelected ? "unit-select-option--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                onChange(unit);
                setOpen(false);
              }}
            >
              <ScientificText>{label}</ScientificText>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="unit-select">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="input unit-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="unit-select-trigger-label">
          <ScientificText>{selectedLabel}</ScientificText>
        </span>
        <span className="unit-select-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
}
