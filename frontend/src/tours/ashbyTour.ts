import type { TourStep } from "../components/TabTour";

/** Пошаговое обучение вкладки «Диаграмма Эшби». */
export const ASHBY_TOUR_STEPS: TourStep[] = [
  {
    id: "area",
    title: "Область применения",
    text: "Отфильтруйте материалы по области применения. Значение «Все» показывает полный набор классов.",
    selector: "[data-tour='ashby-area']",
    placement: "right",
  },
  {
    id: "x-axis",
    title: "Ось X",
    text: "Выберите свойство для горизонтальной оси диаграммы Эшби.",
    selector: "[data-tour='ashby-x-axis']",
    placement: "right",
  },
  {
    id: "y-axis",
    title: "Ось Y",
    text: "Выберите свойство для вертикальной оси. Оно должно отличаться от оси X.",
    selector: "[data-tour='ashby-y-axis']",
    placement: "right",
  },
  {
    id: "classes",
    title: "Классы материалов",
    text: "Отметьте один или несколько классов — на диаграмме появятся точки и выпуклые оболочки выбранных групп.",
    selector: "[data-tour='ashby-classes']",
    placement: "right",
  },
  {
    id: "plot",
    title: "Построить диаграмму",
    text: "После выбора осей и классов нажмите «Построить диаграмму». «Сбросить» очищает выбор и график.",
    selector: "[data-tour='ashby-actions']",
    placement: "right",
  },
  {
    id: "chart",
    title: "Поле диаграммы",
    text: "Здесь отображается диаграмма Эшби: точки материалов, оболочки классов, заголовок и легенда внутри поля осей.",
    selector: "[data-tour='ashby-chart']",
    placement: "left",
  },
  {
    id: "toolbar",
    title: "Инструменты графика",
    text: "Справа от графика: исходный масштаб, перемещение, рамка зума, приближение/отдаление и сохранение в PNG или SVG. Инструменты активны после построения диаграммы.",
    selector: "[data-tour='ashby-toolbar']",
    placement: "left",
    /** Вертикальная панель — удлиняем по высоте, почти без расширения по ширине. */
    paddingX: 10,
    paddingY: 14,
  },
];
