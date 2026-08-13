import type { SourceItem } from "../types/api";

const EXTERNAL_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

export function isExternalSourceLink(link: string): boolean {
  return EXTERNAL_URL_RE.test(link.trim());
}

export function getSourceOpenHref(source: SourceItem): string | null {
  const link = source.hyperlink?.trim();
  if (!link) {
    return null;
  }
  if (isExternalSourceLink(link)) {
    return link;
  }
  return `/api/sources/${source.id_source}/open-link`;
}

export function openSourceLink(source: SourceItem): void {
  const href = getSourceOpenHref(source);
  if (!href) {
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}

export function validateSourceHyperlink(hyperlink: string): string | null {
  const value = hyperlink.trim();
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value) && !/^https?:\/\/.+/i.test(value)) {
    return "Ссылка должна начинаться с http:// или https://";
  }
  return null;
}
