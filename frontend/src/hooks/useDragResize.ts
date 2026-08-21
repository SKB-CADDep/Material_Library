import { useCallback, useRef, useState, type CSSProperties } from "react";

export type DragResizeAxis = "x" | "y";

export type UseDragResizeOptions = {
  axis: DragResizeAxis;
  initial: number;
  min: number;
  max: number;
  storageKey?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredSize(
  storageKey: string | undefined,
  initial: number,
  min: number,
  max: number,
): number {
  if (!storageKey) {
    return initial;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return initial;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return initial;
    }
    return clamp(parsed, min, max);
  } catch {
    return initial;
  }
}

export function useDragResize({
  axis,
  initial,
  min,
  max,
  storageKey,
}: UseDragResizeOptions) {
  const [size, setSize] = useState(() =>
    readStoredSize(storageKey, initial, min, max),
  );
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onHandleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const startPos = axis === "x" ? event.clientX : event.clientY;
      const startSize = sizeRef.current;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const currentPos = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentPos - startPos;
        const next = clamp(startSize + delta, min, max);
        setSize(next);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (storageKey) {
          try {
            localStorage.setItem(storageKey, String(sizeRef.current));
          } catch {
            /* ignore quota errors */
          }
        }
      };

      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [axis, min, max, storageKey],
  );

  const style: CSSProperties =
    axis === "x" ? { width: size, flex: "none" } : { height: size, flex: "none" };

  return { size, style, onHandleMouseDown };
}
