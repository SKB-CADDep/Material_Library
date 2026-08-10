import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSource, updateSource, deleteSource } from "../api/sources";
import { refreshSourcesAfterCrud } from "../lib/sourcesCatalog";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { TruncatedText } from "../components/TruncatedText";
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from "react-router-dom";
import type { SourceItem, TabType } from "../types/api";

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

type DialogMode = 'create' | 'edit' | 'delete' | null;

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
  const hyperlink = formData.hyperlink.trim();
  if (hyperlink && !/^https?:\/\/.+/i.test(hyperlink)) {
    return "Ссылка должна начинаться с http:// или https://";
  }
  return null;
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
  };

  const currentTabConfig = TAB_CONFIG[activeTab];
  const currentData = data?.[currentTabConfig.apiKey] || [];

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return currentData;
    }

    const sortKey = sortConfig.key;
    const direction = sortConfig.direction;

    return [...currentData].sort((a, b) => {
      const aValue = a[sortKey] || '';
      const bValue = b[sortKey] || '';
      const comparison = aValue.toString().localeCompare(bValue.toString(), 'ru', {
        sensitivity: 'base'
      });
      return direction === 'asc' ? comparison : -comparison;
    });
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

  const openDeleteDialog = (item: SourceItem) => {
    resetDialogMutations();
    setDialogMode('delete');
    setSelectedItem(item);
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

  if (isLoading) {
    return (
      <div className="source-page">
        <header className="page-header">
          <h1>Работа с источниками</h1>
        </header>
        <div className="loading-container">
          <p className="tab-placeholder">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return (
      <div className="source-page">
        <header className="page-header">
          <h1>Работа с источниками</h1>
        </header>
        <div className="error-container">
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <h2>Ошибка загрузки данных</h2>
            <p className="error-message">{errorMessage}</p>
            <button className="retry-button" onClick={() => refetch()}>
              🔄 Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="source-page">
        <header className="page-header">
          <h1>Работа с источниками</h1>
        </header>
        <div className="error-container">
          <div className="error-card">
            <div className="error-icon">📭</div>
            <h2>Данные не получены</h2>
            <button className="retry-button" onClick={() => refetch()}>
              🔄 Повторить
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
      return <span className="sort-indicator">↕</span>;
    }
    return (
      <span className={`sort-indicator active`}>
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="source-page">
      {/* ============================================================ */}
      {/* ============== ДИАЛОГ В САМОМ НАЧАЛЕ КОМПОНЕНТА ============= */}
      {/* ============================================================ */}
      {dialogMode && (
        <div className="dialog-overlay" onClick={closeDialog}>
          <div className="dialog-content dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>
                {dialogMode === 'create' && '➕ Добавление источника'}
                {dialogMode === 'edit' && '✏️ Редактирование источника'}
                {dialogMode === 'delete' && '🗑️ Подтверждение удаления'}
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
                    <input
                      id="name_source"
                      type="text"
                      className="form-input"
                      value={formData.name_source}
                      onChange={(e) => handleFormChange('name_source', e.target.value)}
                      placeholder="Введите наименование"
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
                      placeholder="https://example.com"
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

      <header className="page-header">
        <h1>Работа с источниками</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openCreateDialog}>
            + Добавить источник
          </button>
        </div>
        <div className="sources-stats">
          <div className="stat-item">
            <span className="stat-label">{TAB_CONFIG.property_sources.label}:</span>
            <span className="stat-value">{data.property_sources?.length || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{TAB_CONFIG.strength_sources.label}:</span>
            <span className="stat-value">{data.strength_sources?.length || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{TAB_CONFIG.chemical_sources.label}:</span>
            <span className="stat-value">{data.chemical_sources?.length || 0}</span>
          </div>
        </div>
      </header>

      <nav className="nested-tabs" role="tablist">
        {Object.entries(TAB_CONFIG).map(([key, config]) => {
          const count = data[config.apiKey]?.length || 0;
          const isActive = activeTab === key;

          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              className={`nested-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(key as TabType)}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </nav>

      <section className="tab-content">
        <div className="table-panel">
          <div className="table-wrapper">
            <div className="property-section-fields">
              {sortedData.length === 0 ? (
                <p className="tab-placeholder">Нет данных для отображения</p>
              ) : (
                <table className="data-table">
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
                      <th className="col-date">Дата изм.</th>
                      <th className="col-user">Кто создал</th>
                      <th className="col-date">Дата созд.</th>
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
                              href={source.hyperlink}
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
                          <TruncatedText value={source.data_change || ''} />
                        </td>
                        <td className="col-user">
                          <TruncatedText value={source.user_name_found || ''} />
                        </td>
                        <td className="col-date">
                          <TruncatedText value={source.data_found || ''} />
                        </td>
                        <td className="col-actions">
                          <button
                            className="action-btn edit-btn"
                            onClick={() => openEditDialog(source)}
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => openDeleteDialog(source)}
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default SourcesPage;