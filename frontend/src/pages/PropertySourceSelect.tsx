import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SourceItem } from "../types/api";

export type PropertySourceFields = {
  property_subsource?: string | number | readonly string[] | null;
  source_ref_id?: string | null;
};

export function resolvePropertySourceName(
  prop: PropertySourceFields | undefined,
  sources: SourceItem[],
): string {
  const refId = String(prop?.source_ref_id ?? "").trim();
  if (refId) {
    return sources.find((src) => src.id_source === refId)?.name_source ?? refId;
  }
  return String(prop?.property_subsource ?? "").trim();
}

export function isOrphanSource(current: string, sourceNames: string[]): boolean {
  return current !== "" && !sourceNames.includes(current);
}

type PropertySourceSelectProps = {
  id: string;
  value: string;
  showOrphan: boolean;
  sources: SourceItem[];
  onChange: (name: string, sourceRefId: string) => void;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const EMPTY_LABEL = "— не выбран —";

type SourceOption = {
  name: string;
  sourceRefId: string;
  label: string;
};

export function PropertySourceSelect({
  id,
  value,
  showOrphan,
  sources,
  onChange,
}: PropertySourceSelectProps) {
  const [open, setOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const options: SourceOption[] = [
    { name: "", sourceRefId: "", label: EMPTY_LABEL },
    ...(showOrphan
      ? [{ name: value, sourceRefId: "", label: value }]
      : []),
    ...sources.map((src) => ({
      name: src.name_source,
      sourceRefId: src.id_source ?? "",
      label: src.name_source,
    })),
  ];

  const selectedLabel =
    options.find((option) => option.name === value)?.label ??
    value ??
    EMPTY_LABEL;

  useEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      setPanelPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(280, Math.max(80, spaceBelow)),
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
          maxHeight: panelPosition.maxHeight,
        }}
      >
        {options.map((option, index) => {
          const isSelected = option.name === value;
          return (
            <button
              key={`${option.sourceRefId || option.name || "empty"}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={[
                "unit-select-option",
                isSelected ? "unit-select-option--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={option.label}
              onClick={() => {
                onChange(option.name, option.sourceRefId);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="unit-select property-source-select">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="input unit-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        title={selectedLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="unit-select-trigger-label">{selectedLabel}</span>
        <span className="unit-select-trigger-caret" aria-hidden>
          ▾
        </span>
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
}
