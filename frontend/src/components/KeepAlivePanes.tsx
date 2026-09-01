import { memo, useLayoutEffect, useState, type ReactNode } from "react";
import { KeepAlivePaneActiveProvider } from "../context/KeepAlivePaneContext";

export type KeepAlivePane = {
  key: string;
  node: ReactNode;
};

type KeepAlivePanesProps = {
  activeKey: string;
  panes: KeepAlivePane[];
  className?: string;
};

type KeepAlivePaneSlotProps = {
  paneKey: string;
  active: boolean;
  className?: string;
  children: ReactNode;
};

const KeepAlivePaneSlot = memo(function KeepAlivePaneSlot({
  paneKey,
  active,
  className,
  children,
}: KeepAlivePaneSlotProps) {
  return (
    <div
      data-keep-alive-key={paneKey}
      className={["keep-alive-pane", className].filter(Boolean).join(" ")}
      hidden={!active}
      inert={!active}
      aria-hidden={!active}
    >
      <KeepAlivePaneActiveProvider active={active}>
        {children}
      </KeepAlivePaneActiveProvider>
    </div>
  );
});

export function KeepAlivePanes({
  activeKey,
  panes,
  className,
}: KeepAlivePanesProps) {
  const [seen, setSeen] = useState(() => new Set([activeKey]));

  useLayoutEffect(() => {
    setSeen((prev) => {
      if (prev.has(activeKey)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeKey);
      return next;
    });
  }, [activeKey]);

  return (
    <>
      {panes.map((pane) => {
        if (!seen.has(pane.key)) {
          return null;
        }
        return (
          <KeepAlivePaneSlot
            key={pane.key}
            paneKey={pane.key}
            active={pane.key === activeKey}
            className={className}
          >
            {pane.node}
          </KeepAlivePaneSlot>
        );
      })}
    </>
  );
}
