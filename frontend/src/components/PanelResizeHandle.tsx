import type { MouseEventHandler } from "react";

type PanelResizeHandleProps = {
  direction: "horizontal" | "vertical";
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  title?: string;
};

export function PanelResizeHandle({
  direction,
  onMouseDown,
  title = "Потяните для изменения размера",
}: PanelResizeHandleProps) {
  return (
    <div
      className={`panel-resize-handle panel-resize-handle--${direction}`}
      role="separator"
      aria-orientation={direction === "horizontal" ? "horizontal" : "vertical"}
      title={title}
      onMouseDown={onMouseDown}
    />
  );
}
