import { useLayoutEffect, useState, type ReactNode } from "react";

export type KeepAlivePane = {
  key: string;
  node: ReactNode;
};

type KeepAlivePanesProps = {
  activeKey: string;
  panes: KeepAlivePane[];
  className?: string;
};

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
        const active = pane.key === activeKey;
        return (
          <div
            key={pane.key}
            className={["keep-alive-pane", className].filter(Boolean).join(" ")}
            hidden={!active}
            inert={!active}
            aria-hidden={!active}
          >
            {pane.node}
          </div>
        );
      })}
    </>
  );
}
