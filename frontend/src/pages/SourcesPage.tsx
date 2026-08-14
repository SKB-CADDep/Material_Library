import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSource, updateSource, deleteSource, getSourceUsage } from "../api/sources";
import { refreshSourcesAfterCrud } from "../lib/sourcesCatalog";
import {
  getSourceOpenHref,
  openSourceLink,
  validateSourceHyperlink,
} from "../lib/sourceLink";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { TruncatedText } from "../components/TruncatedText";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useResizableTableHeaders } from "../hooks/useResizableTableHeaders";
import { useSearchParams } from "react-router-dom";
import type { SourceItem, SourceUsageResponse, TabType } from "../types/api";

const TAB_CONFIG = {
  property_sources: {
    label: 'Источник свойств',
    apiKey: 'property_sources' as const
  },
  strength_sources: {
    label: 'Источник категории прочности',
    apiKey: 'strength_sources' as const
  },
  chemical_sources: {
    label: 'Источник хим. свойств',
    apiKey: 'chemical_sources' as const
  }
};

type DialogMode = 'create' | 'edit' | 'delete' | 'delete-blocked' | null;

function mutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Не удалось выполнить операцию";
}

function validateSourceFormData(formData: {
  name_source: string;
  hyperlink: string;
}): string | null {
  if (!formData.name_source.trim()) {
    return "Укажите наименование источника";
  }
  return validateSourceHyperlink(formData.hyperlink);
}

function formatSourceDate(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SOURCE_DATE_SORT_KEYS = new Set<keyof SourceItem>(["data_change", "data_found"]);

function parseSourceDateMs(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.getTime();
}

function compareSourceItems(
  a: SourceItem,
  b: SourceItem,
  sortKey: keyof SourceItem,
  direction: "asc" | "desc",
): number {
  if (SOURCE_DATE_SORT_KEYS.has(sortKey)) {
    const aTime = parseSourceDateMs(String(a[sortKey] ?? ""));
    const bTime = parseSourceDateMs(String(b[sortKey] ?? ""));

    if (aTime === null && bTime === null) return 0;
    if (aTime === null) return 1;
    if (bTime === null) return -1;

    const diff = aTime - bTime;
    return direction === "asc" ? diff : -diff;
  }

  const aValue = String(a[sortKey] ?? "");
  const bValue = String(b[sortKey] ?? "");
  const comparison = aValue.localeCompare(bValue, "ru", { sensitivity: "base" });
  return direction === "asc" ? comparison : -comparison;
}

export function SourcesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightSourceId = searchParams.get("source");
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (tabParam && tabParam in TAB_CONFIG) {
      return tabParam as TabType;
    }
    return "property_sources";
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof SourceItem;
    direction: 'asc' | 'desc';
  } | null>(null);
  const sourcesTableRef = useRef<HTMLTableElement>(null);
  useResizableTableHeaders(sourcesTableRef);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedItem, setSelectedItem] = useState<SourceItem | null>(null);
  const [formData, setFormData] = useState<{
    name_source: string;
    description: string;
    hyperlink: string;
  }>({
    name_source: '',
    description: '',
    hyperlink: ''
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [blockedDeleteUsage, setBlockedDeleteUsage] = useState<SourceUsageResponse | null>(null);
  const [deleteCheckPendingId, setDeleteCheckPendingId] = useState<string | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{
    x: number;
    y: number;
    source: SourceItem;
  } | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useSourcesCatalog();

  const createMutation = useMutation({
    mutationFn: createSource,
    onSuccess: async () => {
      await refreshSourcesAfterCrud(queryClient);
      setDialogMode(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; hyperlink?: string } }) =>
      updateSource(id, data),
    onSuccess: async () => {
      await refreshSourcesAfterCrud(queryClient);
      setDialogMode(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: async () => {
      await refreshSourcesAfterCrud(queryClient);
      setDialogMode(null);
      setSelectedItem(null);
    },
  });

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

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
    (activeDialogMutation?.error ? mutationErrorMessage(activeDialogMutation.error) : null);

  const resetDialogMutations = () => {
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
    setValidationError(null);
    setBlockedDeleteUsage(null);
  };

  const currentTabConfig = TAB_CONFIG[activeTab];
  const currentData = data?.[currentTabConfig.apiKey] || [];

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return currentData;
    }

    const sortKey = sortConfig.key;
    const direction = sortConfig.direction;

    return [...currentData].sort((a, b) =>
      compareSourceItems(a, b, sortKey, direction),
    );
  }, [currentData, sortConfig]);

  useEffect(() => {
    if (tabParam && tabParam in TAB_CONFIG) {
      setActiveTab(tabParam as TabType);
    }
  }, [tabParam]);

  useEffect(() => {
    if (!highlightSourceId || sortedData.length === 0) {
      return;
    }

    const row = document.getElementById(`source-row-${highlightSourceId}`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightSourceId, sortedData, activeTab]);

  useEffect(() => {
    if (!linkContextMenu) {
      return;
    }

    const closeMenu = () => setLinkContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [linkContextMenu]);

  const openCreateDialog = () => {
    resetDialogMutations();
    setDialogMode('create');
    setSelectedItem(null);
    setFormData({
      name_source: '',
      description: '',
      hyperlink: ''
    });
  };

  const openEditDialog = (item: SourceItem) => {
    resetDialogMutations();
    setDialogMode('edit');
    setSelectedItem(item);
    setFormData({
      name_source: item.name_source || '',
      description: item.description || '',
      hyperlink: item.hyperlink || ''
    });
  };

  const handleDeleteClick = async (item: SourceItem) => {
    resetDialogMutations();
    setSelectedItem(item);
    setDeleteCheckPendingId(item.id_source);

    try {
      const usage = await getSourceUsage(item.id_source);
      if (usage.count > 0) {
        setBlockedDeleteUsage(usage);
        setDialogMode('delete-blocked');
        return;
      }
      setDialogMode('delete');
    } catch (error) {
      setValidationError(mutationErrorMessage(error));
      setDialogMode('delete-blocked');
    } finally {
      setDeleteCheckPendingId(null);
    }
  };

  const closeDialog = () => {
    resetDialogMutations();
    setDialogMode(null);
    setSelectedItem(null);
  };

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setValidationError(null);
    if (dialogMode === "create" && createMutation.isError) {
      createMutation.reset();
    } else if (dialogMode === "edit" && updateMutation.isError) {
      updateMutation.reset();
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const validationMessage = validateSourceFormData(formData);
    if (validationMessage) {
      setValidationError(validationMessage);
      return;
    }

    if (dialogMode === 'create') {
      createMutation.mutate({
        name: formData.name_source,
        description: formData.description,
        hyperlink: formData.hyperlink,
        group: activeTab
      });
    } else if (dialogMode === 'edit' && selectedItem) {
      updateMutation.mutate({
        id: selectedItem.id_source,
        data: {
          name: formData.name_source,
          description: formData.description,
          hyperlink: formData.hyperlink
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedItem) return;
    deleteMutation.mutate(selectedItem.id_source);
  };

  const handleRowContextMenu = (
    event: React.MouseEvent<HTMLTableRowElement>,
    source: SourceItem,
  ) => {
    event.preventDefault();
    setLinkContextMenu({
      x: event.clientX,
      y: event.clientY,
      source,
    });
  };

  const handleOpenLinkFromContextMenu = () => {
    if (!linkContextMenu?.source.hyperlink.trim()) {
      return;
    }
    openSourceLink(linkContextMenu.source);
    setLinkContextMenu(null);
  };

  if (isLoading) {
    return (
      <div className="source-page">
        <div className="editor-panel-state">
          <p className="tab-placeholder">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return (
      <div className="source-page">
        <div className="editor-panel-state">
          <div className="error-card">
            <h2>Ошибка загрузки данных</h2>
            <p className="error-message">{errorMessage}</p>
            <button type="button" className="retry-button" onClick={() => refetch()}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="source-page">
        <div className="editor-panel-state">
          <div className="error-card">
            <h2>Данные не получены</h2>
            <button type="button" className="retry-button" onClick={() => refetch()}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSort = (key: keyof SourceItem) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIndicator = (key: keyof SourceItem) => {
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

  return (
    <div className="source-page">
      {linkContextMenu && (
        <div
          className="context-menu source-page__context-menu"
          style={{
            position: "fixed",
            top: linkContextMenu.y,
            left: linkContextMenu.x,
            zIndex: 1100,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="context-menu-item source-page__context-menu-item"
            disabled={!linkContextMenu.source.hyperlink.trim()}
            onClick={handleOpenLinkFromContextMenu}
          >
            Открыть ссылку
          </button>
        </div>
      )}
      {dialogMode && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div className="dialog-content dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>
                {dialogMode === 'create' && 'Добавление источника'}
                {dialogMode === 'edit' && 'Редактирование источника'}
                {dialogMode === 'delete' && 'Подтверждение удаления'}
                {dialogMode === 'delete-blocked' && 'Ошибка удаления'}
              </h3>
              <button className="dialog-close" onClick={closeDialog}>×</button>
            </div>

            {dialogMode === 'create' || dialogMode === 'edit' ? (
              <form onSubmit={handleFormSubmit} noValidate>
                <div className="dialog-body">
                  {dialogError && (
                    <div className="dialog-error" role="alert">
                      {dialogError}
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="name_source">Наименование <span className="required">*</span></label>
                    <textarea
                      id="name_source"
                      className="form-textarea form-textarea--name"
                      value={formData.name_source}
                      onChange={(e) => handleFormChange('name_source', e.target.value)}
                      placeholder="Введите наименование"
                      rows={4}
                      autoFocus
                      aria-invalid={Boolean(validationError && !formData.name_source.trim())}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="description">Описание</label>
                    <textarea
                      id="description"
                      className="form-textarea"
                      value={formData.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      placeholder="Введите описание"
                      rows={3}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hyperlink">Ссылка</label>
                    <input
                      id="hyperlink"
                      type="text"
                      className="form-input"
                      value={formData.hyperlink}
                      onChange={(e) => handleFormChange('hyperlink', e.target.value)}
                      placeholder="https://..., normacs://... или файл.pdf"
                      inputMode="url"
                    />
                  </div>
                </div>
                <div className="dialog-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeDialog} disabled={isSubmitting}>
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Сохранение...' : dialogMode === 'create' ? 'Создать' : 'Сохранить'}
                  </button>
                </div>
              </form>
            ) : dialogMode === 'delete-blocked' ? (
              <>
                <div className="dialog-body">
                  {validationError ? (
                    <div className="dialog-error" role="alert">
                      {validationError}
                    </div>
                  ) : blockedDeleteUsage && blockedDeleteUsage.count > 0 ? (
                    <>
                      <p className="dialog-error-title">Нельзя удалить источник!</p>
                      <p>
                        Он используется в {blockedDeleteUsage.count} материалах, например:
                      </p>
                      <ul className="dialog-usage-list">
                        {blockedDeleteUsage.examples.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                      {blockedDeleteUsage.count > blockedDeleteUsage.examples.length && (
                        <p className="dialog-usage-more">...</p>
                      )}
                    </>
                  ) : null}
                </div>
                <div className="dialog-footer">
                  <button type="button" className="btn btn-primary" onClick={closeDialog}>
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="dialog-body">
                  {dialogError && (
                    <div className="dialog-error" role="alert">
                      {dialogError}
                    </div>
                  )}
                  <p>Вы уверены, что хотите удалить запись <strong>«{selectedItem?.name_source || 'без названия'}»</strong>?</p>
                  <p className="dialog-warning">Это действие невозможно отменить.</p>
                </div>
                <div className="dialog-footer">
                  <button className="btn btn-secondary" onClick={closeDialog} disabled={isSubmitting}>
                    Отмена
                  </button>
                  <button className="btn btn-danger" onClick={handleDeleteConfirm} disabled={isSubmitting}>
                    {isSubmitting ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ================ ОСНОВНОЕ СОДЕРЖИМОЕ СТРАНИЦЫ =============== */}
      {/* ============================================================ */}

      <div className="source-page__toolbar">
        <nav className="source-page__tabs" role="tablist">
          {Object.entries(TAB_CONFIG).map(([key, config]) => {
            const count = data[config.apiKey]?.length || 0;
            const isActive = activeTab === key;

            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                className={`source-page__tab ${isActive ? 'source-page__tab--active' : ''}`}
                onClick={() => setActiveTab(key as TabType)}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </nav>
        <button type="button" className="btn btn-primary" onClick={openCreateDialog}>
          + Добавить источник
        </button>
      </div>

      <section className="source-page__body">
        <div className="source-page__table-panel">
          <div className="source-page__table-viewport">
            {sortedData.length === 0 ? (
              <p className="tab-placeholder">Нет данных для отображения</p>
            ) : (
              <table ref={sourcesTableRef} className="data-table data-table--sources">
                  <thead>
                    <tr>
                      <th className="col-index">#</th>
                      <th className="sortable col-name">
                        <span
                          className="sort-label"
                          onClick={() => handleSort('name_source')}
                          title="Сортировать по имени"
                        >
                          Наименование {getSortIndicator('name_source')}
                        </span>
                      </th>
                      <th className="col-description">Описание</th>
                      <th className="col-link">Ссылка</th>
                      <th className="col-user">Кто изменил</th>
                      <th className="sortable col-date">
                        <span
                          className="sort-label"
                          onClick={() => handleSort("data_change")}
                          title="Сортировать по дате изменения"
                        >
                          Дата изм. {getSortIndicator("data_change")}
                        </span>
                      </th>
                      <th className="col-user">Кто создал</th>
                      <th className="sortable col-date">
                        <span
                          className="sort-label"
                          onClick={() => handleSort("data_found")}
                          title="Сортировать по дате создания"
                        >
                          Дата созд. {getSortIndicator("data_found")}
                        </span>
                      </th>
                      <th className="col-actions">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((source, index) => (
                      <tr
                        key={source.id_source}
                        id={`source-row-${source.id_source}`}
                        className={
                          highlightSourceId === source.id_source
                            ? "source-row--highlight"
                            : undefined
                        }
                        onContextMenu={(event) => handleRowContextMenu(event, source)}
                      >
                        <td className="col-index">{index + 1}</td>
                        <td className="col-name">
                          <TruncatedText value={source.name_source} />
                        </td>
                        <td className="col-description">
                          <TruncatedText value={source.description} />
                        </td>
                        <td className="col-link">
                          {source.hyperlink ? (
                            <TruncatedText
                              value={source.hyperlink}
                              href={getSourceOpenHref(source) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-cell"
                            />
                          ) : '—'}
                        </td>
                        <td className="col-user">
                          <TruncatedText value={source.user_name_change || ''} />
                        </td>
                        <td className="col-date">
                          <TruncatedText
                            value={formatSourceDate(source.data_change || "")}
                            tooltip={source.data_change || undefined}
                          />
                        </td>
                        <td className="col-user">
                          <TruncatedText value={source.user_name_found || ''} />
                        </td>
                        <td className="col-date">
                          <TruncatedText
                            value={formatSourceDate(source.data_found || "")}
                            tooltip={source.data_found || undefined}
                          />
                        </td>
                        <td className="col-actions">
                          <div className="source-page__actions">
                            <button
                              type="button"
                              className="source-page__action-btn source-page__action-btn--edit"
                              onClick={() => openEditDialog(source)}
                              title="Редактировать"
                              aria-label="Редактировать"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="source-page__action-btn source-page__action-btn--delete"
                              onClick={() => void handleDeleteClick(source)}
                              disabled={deleteCheckPendingId === source.id_source}
                              title="Удалить"
                              aria-label="Удалить"
                            >
                              {deleteCheckPendingId === source.id_source ? "…" : "🗑️"}
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

export default SourcesPage;