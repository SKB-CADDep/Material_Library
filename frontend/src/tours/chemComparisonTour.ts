import type { TourStep } from "../components/TabTour";

/** Пошаговое обучение вкладки «Сравнение материалов (хим. состав)». */
export const CHEM_COMPARISON_TOUR_STEPS: TourStep[] = [
  {
    id: "scenario-standards",
    title: "Сценарий сравнения",
    text: "Начните с сценария «По стандартам для материала».",
    selector: "[data-tour='chem-scenario-standards']",
    placement: "bottom",
  },
  {
    id: "area",
    title: "Область применения",
    text: "Отфильтруйте материалы по области применения.",
    selector: "[data-tour='chem-s1-area']",
    placement: "right",
  },
  {
    id: "search",
    title: "Поиск материала",
    text: "Введите название материала, чтобы быстро найти нужный вариант.",
    selector: "[data-tour='chem-s1-search']",
    placement: "right",
  },
  {
    id: "materials",
    title: "Список материалов",
    text: "Выберите материал в списке — справа обновятся результаты сравнения.",
    selector: "[data-tour='chem-s1-materials']",
    placement: "right",
  },
  {
    id: "pivot",
    title: "Таблица состава",
    text: "Здесь отображается сводная таблица: элементы и их значения по источникам состава.",
    selector: "[data-tour='chem-s1-pivot']",
    placement: "left",
    geometryDelay: 250,
  },
  {
    id: "sources",
    title: "Источники",
    text: "В таблице источников можно увидеть, откуда берутся значения состава (и единицы измерения).",
    selector: "[data-tour='chem-s1-sources']",
    placement: "left",
    geometryDelay: 250,
  },
  {
    id: "scenario-target",
    title: "Сценарий сравнения",
    text: "Переключимся на сценарий «Подбор по целевому составу».",
    selector: "[data-tour='chem-scenario-target']",
    placement: "bottom",
    geometryDelay: 50,
    onEnter: () => {
      window.dispatchEvent(
        new CustomEvent("chemComparisonSetScenario", {
          detail: { scenario: "target" },
        }),
      );
    },
  },
  {
    id: "s2-area",
    title: "Область применения",
    text: "Отфильтруйте данные кандидатов по области применения.",
    selector: "[data-tour='chem-s2-area']",
    placement: "right",
  },
  {
    id: "s2-target-table",
    title: "Целевой состав",
    text: "Заполните элементы и целевые значения в таблице слева.",
    selector: "[data-tour='chem-s2-target-table']",
    placement: "right",
  },
  {
    id: "s2-add-row",
    title: "Добавить строку",
    text: "Нажмите «+», чтобы добавить ещё одну строку целевого состава.",
    selector: "[data-tour='chem-s2-add-row']",
    placement: "right",
    geometryDelay: 100,
  },
  {
    id: "s2-results",
    title: "Результаты подбора",
    text: "Сюда выводятся кандидаты, найденные по указанному целевому составу.",
    selector: "[data-tour='chem-s2-results-table']",
    placement: "left",
    geometryDelay: 250,
  },
  {
    id: "s2-details",
    title: "Детализация",
    text: "Выбрав кандидата в таблице результатов, посмотрите детальные сравнения по элементам.",
    selector: "[data-tour='chem-s2-details-table']",
    placement: "left",
    geometryDelay: 250,
  },
];

