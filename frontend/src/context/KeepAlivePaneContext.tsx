import { createContext, useContext, type ReactNode } from "react";

const KeepAlivePaneActiveContext = createContext(true);

export function KeepAlivePaneActiveProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const parentActive = useContext(KeepAlivePaneActiveContext);
  const effectiveActive = active && parentActive;

  return (
    <KeepAlivePaneActiveContext.Provider value={effectiveActive}>
      {children}
    </KeepAlivePaneActiveContext.Provider>
  );
}

export function useKeepAlivePaneActive(): boolean {
  return useContext(KeepAlivePaneActiveContext);
}
