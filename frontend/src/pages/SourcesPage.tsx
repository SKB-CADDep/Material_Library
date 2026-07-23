import { useQuery } from "@tanstack/react-query";
import { getSources } from "../api/sources";
import React, { useState } from 'react';

export interface SourceItem {
  name_source: string;
  description: string;
  hyperlink: string;
  user_name_change: string;
  data_change: string;
  user_name_found: string;
  data_found: string;
}

export type SourcesResponse = {
  property_sources: SourceItem[];
  strength_sources: SourceItem[];
  chemical_sources: SourceItem[];
};

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

type TabType = keyof typeof TAB_CONFIG;

export function SourcesPage() {
  const result = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
  });


//   console.log('=== ВСЕ ДАННЫЕ result ===');
//   console.log('result.data:', result.data);
//   console.log('result.error:', result.error);
//
//   // Проверка структуры данных
//   if (result.data) {
//     console.log('Ключи в data:', Object.keys(result.data));
//     console.log('property_sources:', result.data.property_sources);
//     console.log('strength_sources:', result.data.strength_sources);
//     console.log('chemical_sources:', result.data.chemical_sources);
//   }


  const [activeTab, setActiveTab] = useState<TabType>('property_sources');

  if (result.isLoading) {
    return <p className="tab-placeholder">Загрузка...</p>;
  }

  if (result.isError) {
    return <p className="tab-placeholder">Ошибка загрузки данных</p>;
  }

  const data = result.data as SourcesResponse;
  const currentTabConfig = TAB_CONFIG[activeTab];
  const currentData: SourceItem[] = data[currentTabConfig.apiKey] || [];

  return (
    <div className="source-page">
      {/* 1. ЗАГОЛОВОК СТРАНИЦЫ */}
      <header className="page-header">
        <h1>Работа с источниками</h1>
        <div className="sources-stats">
          <div className="stat-item">
            <span className="stat-label">{TAB_CONFIG.property_sources.label}:</span>
            <span className="stat-value">{data.property_sources.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{TAB_CONFIG.strength_sources.label}:</span>
            <span className="stat-value">{data.strength_sources.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{TAB_CONFIG.chemical_sources.label}:</span>
            <span className="stat-value">{data.chemical_sources.length}</span>
          </div>
        </div>
      </header>

      {/* 2. ВКЛАДКИ */}
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

      {/* 3. ПАНЕЛЬ С ТАБЛИЦЕЙ */}
      <section className="tab-content">
        <div className="table-panel">
          <div className="table-wrapper">
            <div className="property-section-fields">
              {currentData.length === 0 ? (
                <p className="tab-placeholder">Нет данных для отображения</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      <th style={{ width: '80px' }}>ID</th>
                      <th>Наименование</th>
                      <th>Описание</th>
                      <th>Ссылка</th>
                      <th>Кто изменил</th>
                      <th>Дата изменения</th>
                      <th>Кто создал</th>
                      <th>Дата создания</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.map((source, index) => (
                      <tr key={source.id_source}>
                        <td style={{ textAlign: 'center' }}>{index + 1}</td>
                        <td style={{ textAlign: 'center' }}>{source.id_source}</td>
                        <td>{source.name_source || '—'}</td>
                        <td>{source.description || '—'}</td>
                        <td>
                          {source.hyperlink ? (
                            <a href={source.hyperlink} target="_blank" rel="noopener noreferrer">
                              Открыть
                            </a>
                          ) : '—'}
                        </td>
                        <td>{source.user_name_change || '—'}</td>
                        <td>{source.data_change || '—'}</td>
                        <td>{source.user_name_found || '—'}</td>
                        <td>{source.data_found || '—'}</td>
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