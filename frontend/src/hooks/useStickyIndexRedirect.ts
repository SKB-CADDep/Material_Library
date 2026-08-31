import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useKeepAlivePaneActive } from "../context/KeepAlivePaneContext";

export function useStickyIndexRedirect<T extends string>(
  isIndexPath: (pathname: string) => boolean,
  pathFromKey: (key: T) => string,
  activeKey: T,
): void {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const paneActive = useKeepAlivePaneActive();

  useEffect(() => {
    if (!paneActive) {
      return;
    }
    if (!isIndexPath(pathname)) {
      return;
    }
    navigate(pathFromKey(activeKey), { replace: true });
  }, [paneActive, pathname, activeKey, navigate, isIndexPath, pathFromKey]);
}
