import {
  editorTabKeyFromPath,
  mainPageKeyFromPath,
  selectionTabKeyFromPath,
  type EditorTabKey,
  type MainPageKey,
  type SelectionTabKey,
} from "./keepAliveRoutes";

const MAIN_LABELS: Record<MainPageKey, string> = {
  selection: "Подбор материала",
  editor: "Добавление / Редактирование",
  sources: "Работа с источниками",
  elements: "Справочник элементов",
};

const SELECTION_TAB_LABELS: Record<SelectionTabKey, string> = {
  temperature: "Подбор по температуре",
  calc: "Расчёт отдельно",
  "compare-props": "Сравнение материалов (свойства)",
  "compare-chem": "Сравнение материалов (хим. состав)",
  ashby: "Диаграмма Эшби",
  "larson-miller": "Ларсон–Миллер",
};

const EDITOR_TAB_LABELS: Record<EditorTabKey, string> = {
  general: "Общие данные",
  physical: "Физические свойства",
  mechanical: "Механические свойства",
  chemical: "Химический состав",
};

export type AuditNavTarget = {
  container: string;
  tab: string;
};

/** Разбор pathname → контейнер / вкладка для NAV_TAB_SELECTED. */
export function auditNavFromPath(pathname: string): AuditNavTarget {
  const main = mainPageKeyFromPath(pathname);
  if (main === "selection") {
    const sub = selectionTabKeyFromPath(pathname);
    return {
      container: MAIN_LABELS.selection,
      tab: sub ? SELECTION_TAB_LABELS[sub] : MAIN_LABELS.selection,
    };
  }
  if (main === "editor") {
    const sub = editorTabKeyFromPath(pathname);
    return {
      container: MAIN_LABELS.editor,
      tab: sub ? EDITOR_TAB_LABELS[sub] : MAIN_LABELS.editor,
    };
  }
  return {
    container: "Главное окно",
    tab: MAIN_LABELS[main],
  };
}
