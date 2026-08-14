import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TabErrorBoundary } from "../components/TabErrorBoundary";
import { useWorkspace } from "../context/WorkSpaceContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useSourcesCatalog } from "../hooks/useSourcesCatalog";
import { getMaterial, listMaterials } from "../api/materials";
import {
  buildChemComparisonView,
  type CompositionEntry,
} from "../lib/chemComparisonPivot";
import { ChemComparisonSourcesTable } from "../components/ChemComparisonSourcesTable";
import { ChemComparisonPivotPanel } from "../components/ChemComparisonPivotTable";
import { ChemComparisonNotesSection } from "../components/ChemComparisonNotesSection";
import { ApplicationAreaFilter } from "../components/ApplicationAreaFilter";
import { materialMatchesApplicationAreas } from "../lib/applicationAreaFilter";

const SEARCH_DEBOUNCE_MS = 300;

type ChemicalPropertiesData = {
  composition?: CompositionEntry[];
};

function hasComposition(material: Record<string, unknown> | undefined): boolean {
  const chemical = material?.chemical_properties as ChemicalPropertiesData | undefined;
  return (chemical?.composition?.length ?? 0) > 0;
}

export function ChemComparisonScenario1Tab() {
  const { workspace } = useWorkspace();
  const areaOptions = workspace?.application_areas ?? [];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: listMaterials,
    enabled: Boolean(workspace),
  });

  const detailQuery = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId!),
    enabled: selectedId !== null,
  });
  const sourcesQuery = useSourcesCatalog();
  const chemicalSources = sourcesQuery.data?.chemical_sources ?? [];

  const materialsWithComposition = useMemo(
    () => (materialsQuery.data ?? []).filter((item) => item.has_composition),
    [materialsQuery.data],
  );

  const filteredMaterials = useMemo(() => {
    const search = debouncedSearch.trim().toLowerCase();
    return materialsWithComposition.filter((item) => {
      if (!materialMatchesApplicationAreas(item.areas, selectedAreas)) {
        return false;
      }
      if (search && !item.name.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }, [materialsWithComposition, selectedAreas, debouncedSearch]);

  useEffect(() => {
    if (filteredMaterials.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((prev) => {
      if (prev !== null && filteredMaterials.some((item) => item.id === prev)) {
        return prev;
      }
      return filteredMaterials[0]?.id ?? null;
    });
  }, [filteredMaterials]);

  const selectedMaterial = filteredMaterials.find((item) => item.id === selectedId);
  const composition = useMemo(() => {
    const chemical = detailQuery.data?.chemical_properties as
      | ChemicalPropertiesData
      | undefined;
    return chemical?.composition ?? [];
  }, [detailQuery.data]);
  const comparisonView = useMemo(
    () => buildChemComparisonView(composition, chemicalSources),
    [composition, chemicalSources],
  );
  const compositionReady =
    selectedId !== null &&
    detailQuery.isSuccess &&
    composition.length > 0;

  if (!workspace) {
    return <p className="tab-placeholder">Откройте workspace с материалами</p>;
  }

  return (
    <TabErrorBoundary resetKey={selectedId}>
      <div className="chem-comparison-layout">
        <aside className="chem-comparison-sidebar">
          <div className="chem-comparison-sidebar-field">
            <label htmlFor="chem-s1-area-filter">Область применения:</label>
            <ApplicationAreaFilter
              id="chem-s1-area-filter"
              options={areaOptions}
              selected={selectedAreas}
              onChange={setSelectedAreas}
            />
          </div>

          <div className="chem-comparison-sidebar-field">
            <label htmlFor="chem-s1-search">Поиск материала:</label>
            <input
              id="chem-s1-search"
              type="search"
              className="input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Название материала"
              autoComplete="off"
            />
          </div>

          <div className="chem-comparison-sidebar-field chem-comparison-sidebar-field--list">
            <span className="chem-comparison-sidebar-label">Материалы:</span>
            {materialsQuery.isPending && (
              <p className="tab-placeholder tab-placeholder--inline">
                Загрузка списка…
              </p>
            )}
            {materialsQuery.isError && (
              <p className="tab-placeholder tab-placeholder--inline tab-placeholder--error">
                {materialsQuery.error.message}
              </p>
            )}
            {materialsQuery.isSuccess && filteredMaterials.length === 0 && (
              <p className="tab-placeholder tab-placeholder--inline">
                Материалы не найдены
              </p>
            )}
            {materialsQuery.isSuccess && filteredMaterials.length > 0 && (
              <div className="chem-comparison-material-list-scroll">
                <ul
                  className="chem-comparison-material-list"
                  role="listbox"
                  aria-label="Материалы"
                >
                  {filteredMaterials.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <li
                        key={item.id}
                        className={
                          isSelected
                            ? "chem-comparison-material-item is-selected"
                            : "chem-comparison-material-item"
                        }
                        role="option"
                        aria-selected={isSelected}
                      >
                        <button
                          type="button"
                          className="chem-comparison-material-btn"
                          onClick={() => setSelectedId(item.id)}
                        >
                          {item.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </aside>

        <main className="chem-comparison-main">
          {!selectedId && (
            <p className="tab-placeholder">
              Выберите материал с химическим составом
            </p>
          )}

          {selectedId && detailQuery.isPending && (
            <p className="tab-placeholder">Загрузка материала…</p>
          )}

          {selectedId && detailQuery.isError && (
            <p className="tab-placeholder tab-placeholder--error">
              {detailQuery.error.message}
            </p>
          )}

          {selectedId &&
            detailQuery.isSuccess &&
            !hasComposition(detailQuery.data) && (
              <p className="tab-placeholder">
                У материала «{selectedMaterial?.name ?? selectedId}» нет
                источников химического состава
              </p>
            )}

          {compositionReady && (
            <div className="chem-comparison-content">
              <ChemComparisonPivotPanel view={comparisonView} />

              <ChemComparisonSourcesTable columns={comparisonView.columns} />

              <ChemComparisonNotesSection columns={comparisonView.columns} />
            </div>
          )}
        </main>
      </div>
    </TabErrorBoundary>
  );
}
