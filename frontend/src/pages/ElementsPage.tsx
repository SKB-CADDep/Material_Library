import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useRef, useState } from "react";
import {
  createElement,
  deleteElement,
  updateElement,
} from "../api/elements";
import { useElementsCatalog } from "../hooks/useElementsCatalog";
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import {
  formatInfluenceText,
  parseInfluenceText,
} from "../lib/elementsCatalog";
import { refreshElementsAfterCrud } from "../lib/elementsCatalogCache";
import type { ElementItem } from "../types/api";

type DialogMode = "create" | "edit" | "delete" | null;

type ElementFormData = {
  symbol: string;
  display_symbol: string;
  name: string;
  improves: string;
  reduces: string;
};

function mutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Не удалось выполнить операцию";
}

function validateElementForm(form: ElementFormData): string | null {
  if (!form.symbol.trim()) {
    return "Укажите символ элемента";
  }
  if (!form.name.trim()) {
    return "Укажите наименование элемента";
  }
  return null;
}

function emptyForm(): ElementFormData {
  return {
    symbol: "",
    display_symbol: "",
    name: "",
    improves: "",
    reduces: "",
  };
}

function formFromItem(item: ElementItem): ElementFormData {
  const parts = parseInfluenceText(item.influence);
  return {
    symbol: item.symbol ?? "",
    display_symbol: item.display_symbol ?? item.symbol ?? "",
    name: item.name ?? "",
    improves: parts.improves,
    reduces: parts.reduces,
  };
}

function ElementInfluenceView({
  influence,
}: {
  influence: string | null | undefined;
}) {
  const parts = parseInfluenceText(influence);
  if (!parts.improves && !parts.reduces) {
    return <span className="element-influence element-influence--empty">—</span>;
  }
  return (
    <div className="element-influence">
      {parts.improves ? (
        <div className="element-influence__row element-influence__row--up">
          <span className="element-influence__label">Повышает</span>
          <span className="element-influence__value">{parts.improves}</span>
        </div>
      ) : null}
      {parts.reduces ? (
        <div className="element-influence__row element-influence__row--down">
          <span className="element-influence__label">Снижает</span>
          <span className="element-influence__value">{parts.reduces}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ElementsPage() {
  const queryClient = useQueryClient();
  const tableRef = useRef<HTMLTableElement>(null);
  useResizableTableHeaders(tableRef);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof ElementItem;
    direction: "asc" | "desc";
  } | null>({ key: "name", direction: "asc" });
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedItem, setSelectedItem] = useState<ElementItem | null>(null);
  const [formData, setFormData] = useState<ElementFormData>(emptyForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const { data, isLoading, isError, error, refetch } = useElementsCatalog();

  const createMutation = useMutation({
    mutationFn: createElement,
    onSuccess: async () => {
      await refreshElementsAfterCrud(queryClient);
      setDialogMode(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      symbol,
      payload,
    }: {
      symbol: string;
      payload: Parameters<typeof updateElement>[1];
    }) => updateElement(symbol, payload),
    onSuccess: async () => {
      await refreshElementsAfterCrud(queryClient);
      setDialogMode(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteElement,
    onSuccess: async () => {
      await refreshElementsAfterCrud(queryClient);
      setDialogMode(null);
      setSelectedItem(null);
    },
  });

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const activeDialogMutation =
    dialogMode === "create"
      ? createMutation
      : dialogMode === "edit"
        ? updateMutation
        : dialogMode === "delete"
          ? deleteMutation
          : null;

  const dialogError =
    validationError ??
    (activeDialogMutation?.error
      ? mutationErrorMessage(activeDialogMutation.error)
      : null);

  const resetDialogMutations = () => {
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
    setValidationError(null);
  };

  const rows = useMemo(() => {
    const list = data?.elements ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? list.filter((item) => {
          const hay = `${item.symbol} ${item.display_symbol} ${item.name} ${item.influence ?? ""}`.toLowerCase();
          return hay.includes(q);
        })
      : list;

    if (!sortConfig) {
      return filtered;
    }
    const { key, direction } = sortConfig;
    return [...filtered].sort((a, b) => {
      const aValue = String(a[key] ?? "");
      const bValue = String(b[key] ?? "");
      const comparison = aValue.localeCompare(bValue, "ru", {
        sensitivity: "base",
      });
      return direction === "asc" ? comparison : -comparison;
    });
  }, [data?.elements, filter, sortConfig]);

  const openCreateDialog = () => {
    resetDialogMutations();
    setDialogMode("create");
    setSelectedItem(null);
    setFormData(emptyForm());
  };

  const openEditDialog = (item: ElementItem) => {
    resetDialogMutations();
    setDialogMode("edit");
    setSelectedItem(item);
    setFormData(formFromItem(item));
  };

  const openDeleteDialog = (item: ElementItem) => {
    resetDialogMutations();
    setSelectedItem(item);
    setDialogMode("delete");
  };

  const closeDialog = () => {
    resetDialogMutations();
    setDialogMode(null);
    setSelectedItem(null);
  };

  const handleFormChange = (field: keyof ElementFormData, value: string) => {
    setValidationError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const errorMessage = validateElementForm(formData);
    if (errorMessage) {
      setValidationError(errorMessage);
      return;
    }

    const payload = {
      symbol: formData.symbol.trim(),
      name: formData.name.trim(),
      display_symbol: formData.display_symbol.trim() || formData.symbol.trim(),
      influence: formatInfluenceText(formData.name.trim() || formData.symbol.trim(), {
        improves: formData.improves,
        reduces: formData.reduces,
      }),
    };

    if (dialogMode === "create") {
      createMutation.mutate(payload);
      return;
    }
    if (dialogMode === "edit" && selectedItem) {
      updateMutation.mutate({
        symbol: selectedItem.symbol,
        payload: {
          ...payload,
          // цвет остаётся в каталоге для графиков, в UI не показываем
          color: selectedItem.color,
        },
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedItem) return;
    deleteMutation.mutate(selectedItem.symbol);
  };

  const handleSort = (key: keyof ElementItem) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIndicator = (key: keyof ElementItem) => {
    if (!sortConfig || sortConfig.key !== key) {
      return (
        <span className="sort-indicator" aria-hidden="true">
          ▲▼
        </span>
      );
    }
    return (
      <span className="sort-indicator active" aria-hidden="true">
        {sortConfig.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="source-page">
        <p className="status-message">Загрузка справочника элементов…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="source-page">
        <p className="status-message error">
          Не удалось загрузить справочник:{" "}
          {error instanceof Error ? error.message : "неизвестная ошибка"}
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => refetch()}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="source-page">
      {dialogMode && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div
            className="dialog-content dialog-large"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-header">
              <h3>
                {dialogMode === "create" && "Добавление элемента"}
                {dialogMode === "edit" && "Редактирование элемента"}
                {dialogMode === "delete" && "Подтверждение удаления"}
              </h3>
              <button type="button" className="dialog-close" onClick={closeDialog}>
                ×
              </button>
            </div>

            {dialogMode === "create" || dialogMode === "edit" ? (
              <form onSubmit={handleFormSubmit} noValidate>
                <div className="dialog-body">
                  {dialogError && (
                    <div className="dialog-error" role="alert">
                      {dialogError}
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="element_symbol">
                      Символ <span className="required">*</span>
                    </label>
                    <input
                      id="element_symbol"
                      type="text"
                      className="form-input"
                      value={formData.symbol}
                      onChange={(e) => handleFormChange("symbol", e.target.value)}
                      placeholder="C, Fe, P+S…"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="element_name">
                      Наименование <span className="required">*</span>
                    </label>
                    <input
                      id="element_name"
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) => handleFormChange("name", e.target.value)}
                      placeholder="Углерод"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="element_display_symbol">Отображаемый символ</label>
                    <input
                      id="element_display_symbol"
                      type="text"
                      className="form-input"
                      value={formData.display_symbol}
                      onChange={(e) =>
                        handleFormChange("display_symbol", e.target.value)
                      }
                      placeholder="N₂ (если отличается)"
                    />
                  </div>
                  <fieldset className="element-influence-fieldset">
                    <legend>Влияние на свойства</legend>
                    <p className="element-influence-hint">
                      Укажите, какие свойства материал получает или теряет при
                      добавлении этого элемента. Можно оставить пустым.
                    </p>
                    <div className="form-group">
                      <label htmlFor="element_improves">Повышает</label>
                      <textarea
                        id="element_improves"
                        className="form-textarea"
                        value={formData.improves}
                        onChange={(e) => handleFormChange("improves", e.target.value)}
                        placeholder="Твердость, прочность, жаростойкость…"
                        rows={2}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="element_reduces">Снижает</label>
                      <textarea
                        id="element_reduces"
                        className="form-textarea"
                        value={formData.reduces}
                        onChange={(e) => handleFormChange("reduces", e.target.value)}
                        placeholder="Пластичность, вязкость…"
                        rows={2}
                      />
                    </div>
                  </fieldset>
                </div>
                <div className="dialog-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeDialog}
                    disabled={isSubmitting}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Сохранение..."
                      : dialogMode === "create"
                        ? "Создать"
                        : "Сохранить"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="dialog-body">
                  {dialogError && (
                    <div className="dialog-error" role="alert">
                      {dialogError}
                    </div>
                  )}
                  <p>
                    Удалить элемент{" "}
                    <strong>
                      {selectedItem?.name} ({selectedItem?.symbol})
                    </strong>
                    ?
                  </p>
                  <p className="dialog-warning">
                    Если элемент уже указан в составах материалов, подписи
                    могут перестать отображаться корректно.
                  </p>
                </div>
                <div className="dialog-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeDialog}
                    disabled={isSubmitting}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteConfirm}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Удаление..." : "Удалить"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="source-page__toolbar">
        <div className="source-page__tabs">
          <span className="source-page__tab source-page__tab--active">
            Элементы ({data?.elements.length ?? 0})
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="search"
            className="form-input"
            placeholder="Поиск по символу или названию…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Поиск элементов"
            style={{ minWidth: "16rem" }}
          />
          <button type="button" className="btn btn-primary" onClick={openCreateDialog}>
            + Добавить элемент
          </button>
        </div>
      </div>

      <section className="source-page__body">
        <div className="source-page__table-panel">
          <div className="source-page__table-viewport">
            {rows.length === 0 ? (
              <p className="tab-placeholder">Нет данных для отображения</p>
            ) : (
              <table ref={tableRef} className="data-table data-table--sources">
                <thead>
                  <tr>
                    <th className="sortable">
                      <span className="sort-label" onClick={() => handleSort("symbol")}>
                        Символ {getSortIndicator("symbol")}
                      </span>
                    </th>
                    <th className="sortable">
                      <span className="sort-label" onClick={() => handleSort("name")}>
                        Наименование {getSortIndicator("name")}
                      </span>
                    </th>
                    <th className="sortable col-influence">
                      <span className="sort-label" onClick={() => handleSort("influence")}>
                        Влияние {getSortIndicator("influence")}
                      </span>
                    </th>
                    <th className="col-actions">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.symbol}>
                      <td>
                        <strong>{item.display_symbol || item.symbol}</strong>
                        {item.display_symbol &&
                          item.display_symbol !== item.symbol && (
                            <span> ({item.symbol})</span>
                          )}
                      </td>
                      <td>{item.name}</td>
                      <td className="col-influence">
                        <ElementInfluenceView influence={item.influence} />
                      </td>
                      <td className="col-actions">
                        <div className="source-page__actions">
                          <button
                            type="button"
                            className="source-page__action-btn source-page__action-btn--edit"
                            onClick={() => openEditDialog(item)}
                            title="Изменить"
                            aria-label="Изменить"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="source-page__action-btn source-page__action-btn--delete"
                            onClick={() => openDeleteDialog(item)}
                            title="Удалить"
                            aria-label="Удалить"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
