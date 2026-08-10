import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSources, createSource, updateSource, deleteSource } from "../api/sources";
import React, { useState, useMemo, useRef, useEffect } from 'react';
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

// ==================== КАСТОМНЫЙ TOOLTIP С ПОЗИЦИОНИРОВАНИЕМ ====================
const TruncatedCell: React.FC<{
  value: string;
  maxLength?: number;
  className?: string;
}> = ({ value, maxLength = 30, className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLSpanElement>(null);

  const text = value || '—';
  const needsTruncation = text.length > maxLength;
  const displayText = needsTruncation ? text.slice(0, maxLength) + '…' : text;

  if (!value || value.trim() === '') {
    return <span className="empty-value">—</span>;
  }

  const updatePosition = () => {
    const rect = cellRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      });
    }
  };

  const handleMouseEnter = () => {
    if (!needsTruncation) return;
    updatePosition();
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  useEffect(() => {
    if (!showTooltip) return;

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [showTooltip]);

  return (
    <span
      ref={cellRef}
      className={`truncated-cell ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="truncated-text">{displayText}</span>
      {showTooltip && needsTruncation && (
        <div
          className="tooltip"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
};

type DialogMode = 'create' | 'edit' | 'delete' | null;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name_source: string;
    description: string;
    hyperlink: string;
  }>({
    name_source: '',
    description: '',
    hyperlink: ''
  });

  const {
    data,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setDialogMode(null);
    },
    onError: (error) => {
      console.error('Ошибка создания:', error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; hyperlink?: string } }) =>
      updateSource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setDialogMode(null);
    },
    onError: (error) => {
      console.error('Ошибка обновления:', error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setDialogMode(null);
      setSelectedItem(null);
    },
    onError: (error) => {
      console.error('Ошибка удаления:', error);
    }
  });

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
    setDialogMode('create');
    setSelectedItem(null);
    setFormData({
      name_source: '',
      description: '',
      hyperlink: ''
    });
  };

  const openEditDialog = (item: SourceItem) => {
    setDialogMode('edit');
    setSelectedItem(item);
    setFormData({
      name_source: item.name_source || '',
      description: item.description || '',
      hyperlink: item.hyperlink || ''
    });
  };

  const openDeleteDialog = (item: SourceItem) => {
    setDialogMode('delete');
    setSelectedItem(item);
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedItem(null);
    setIsSubmitting(false);
  };

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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
    setIsSubmitting(true);
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
              <form onSubmit={handleFormSubmit}>
                <div className="dialog-body">
                  <div className="form-group">
                    <label htmlFor="name_source">Наименование <span className="required">*</span></label>
                    <input
                      id="name_source"
                      type="text"
                      className="form-input"
                      value={formData.name_source}
                      onChange={(e) => handleFormChange('name_source', e.target.value)}
                      placeholder="Введите наименование"
                      required
                      autoFocus
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
                      type="url"
                      className="form-input"
                      value={formData.hyperlink}
                      onChange={(e) => handleFormChange('hyperlink', e.target.value)}
                      placeholder="https://example.com"
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
                          <TruncatedCell
                            value={source.name_source}
                            maxLength={25}
                          />
                        </td>
                        <td className="col-description">
                          <TruncatedCell
                            value={source.description}
                            maxLength={30}
                          />
                        </td>
                        <td className="col-link">
                          {source.hyperlink ? (
                            <a
                              href={source.hyperlink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-cell"
                            >
                              <TruncatedCell
                                value={source.hyperlink}
                                maxLength={20}
                              />
                            </a>
                          ) : '—'}
                        </td>
                        <td className="col-user">
                          <TruncatedCell
                            value={source.user_name_change || ''}
                            maxLength={15}
                          />
                        </td>
                        <td className="col-date">
                          <TruncatedCell
                            value={source.data_change || ''}
                            maxLength={10}
                          />
                        </td>
                        <td className="col-user">
                          <TruncatedCell
                            value={source.user_name_found || ''}
                            maxLength={15}
                          />
                        </td>
                        <td className="col-date">
                          <TruncatedCell
                            value={source.data_found || ''}
                            maxLength={10}
                          />
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