import type { TourStep } from "../components/TabTour";

/** Пошаговое обучение вкладки «Расчёт отдельно». */
export const SEP_CALCULATION_TOUR_STEPS: TourStep[] = [
  {
    id: "area",
    title: "Область применения",
    text: "Отфильтруйте материалы по области применения.",
    selector: "[data-tour='sep-calc-area']",
    placement: "right",
  },
  {
    id: "material",
    title: "Материал",
    text: "Выберите материал — от этого зависят доступные категории прочности и данные расчёта.",
    selector: "[data-tour='sep-calc-material']",
    placement: "bottom",
  },
  {
    id: "category",
    title: "Категория прочности",
    text: "Выберите категорию прочности для расчёта.",
    selector: "[data-tour='sep-calc-category']",
    placement: "bottom",
    geometryDelay: 100,
  },
  {
    id: "ntd",
    title: "НТД",
    text: "Выберите нормативно-технический документ (НТД) для источника данных расчёта.",
    selector: "[data-tour='sep-calc-ntd']",
    placement: "bottom",
    geometryDelay: 100,
  },
  {
    id: "custom-temp",
    title: "Расчёт произвольной точки",
    text: "Введите температуру и нажмите «Добавить расчёт», чтобы добавить расчётную точку к таблице.",
    selector: "[data-tour='sep-calc-custom-temp']",
    placement: "top",
  },
  {
    id: "add-custom",
    title: "Добавить точку",
    text: "Нажмите эту кнопку, чтобы добавить точку расчёта и обновить таблицу.",
    selector: "[data-tour='sep-calc-add-custom']",
    placement: "top",
    geometryDelay: 150,
  },
  {
    id: "table",
    title: "Таблица результатов",
    text: "Здесь отображаются результаты расчёта по выбранной категории и добавленным температурам.",
    selector: "[data-tour='sep-calc-table']",
    placement: "top",
    geometryDelay: 250,
  },
];

