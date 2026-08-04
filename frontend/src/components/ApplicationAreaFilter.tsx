import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ApplicationAreaFilterProps = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  id?: string;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

function formatSelectionLabel(selected: string[]): string {
  if (selected.length === 0) {
    return "Все";
  }
  if (selected.length === 1) {
    return selected[0];
  }
  if (selected.length === 2) {
    return selected.join(", ");
  }
  return `${selected.length} выбрано`;
}

export function ApplicationAreaFilter({
  options,
  selected,
  onChange,
  id,
}: ApplicationAreaFilterProps) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;

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

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (options.length === 0) {
    return (
      <span className="area-filter-empty tab-placeholder tab-placeholder--inline">
        Области не найдены
      </span>
    );
  }

  const allSelected =
    options.length > 0 && options.every((area) => selected.includes(area));

  const panel =
    open && panelPosition ? (
      <div
        ref={panelRef}
        className="area-filter-panel area-filter-panel--portal"
        role="listbox"
        aria-multiselectable
        style={{
          top: panelPosition.top,
          left: panelPosition.left,
          width: panelPosition.width,
        }}
      >
        <div className="area-filter-actions">
          <button
            type="button"
            className="area-filter-action"
            onClick={() => onChange([...options])}
            disabled={allSelected}
          >
            Выбрать все
          </button>
          <button
            type="button"
            className="area-filter-action"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
          >
            Сбросить
          </button>
        </div>

        <div className="checkbox-list area-filter-list">
          {options.map((area) => (
            <label key={area} className="checkbox-item">
              <input
                type="checkbox"
                checked={selected.includes(area)}
                onChange={(event) => {
                  if (event.target.checked) {
                    onChange([...selected, area]);
                  } else {
                    onChange(selected.filter((item) => item !== area));
                  }
                }}
              />
              {area}
            </label>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="area-filter">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="input area-filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="area-filter-trigger-label">
          {formatSelectionLabel(selected)}
        </span>
        <span className="area-filter-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
}
