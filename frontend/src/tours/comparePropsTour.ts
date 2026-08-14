import type { TourStep } from "../components/TabTour";

/** Пошаговое обучение вкладки «Сравнение материалов (свойства)». */
export const COMPARE_PROPS_TOUR_STEPS: TourStep[] = [
  {
    id: "area",
    title: "Область применения",
    text: "Отфильтруйте список материалов по области применения. «Все» показывает полный пул для выбранного свойства.",
    selector: "[data-tour='compare-props-area']",
    placement: "right",
  },
  {
    id: "property",
    title: "Свойство для сравнения",
    text: "Выберите температурно-зависимое свойство — по нему будут сравниваться кривые материалов на графике.",
    selector: "[data-tour='compare-props-property']",
    placement: "right",
  },
  {
    id: "search",
    title: "Поиск материала",
    text: "Введите часть названия, чтобы отфильтровать список ниже. Поиск учитывает уже выбранную область и свойство.",
    selector: "[data-tour='compare-props-search']",
    placement: "right",
  },
  {
    id: "search-results",
    title: "Результаты поиска",
    text: "Здесь материалы и категории прочности с данными по выбранному свойству. Двойной клик по строке добавляет её в выбранные.",
    selector: "[data-tour='compare-props-search-results']",
    placement: "right",
  },
  {
    id: "selected",
    title: "Выбранные материалы",
    text: "Список того, что попадёт на график. Двойной клик по строке убирает материал из выбора.",
    selector: "[data-tour='compare-props-selected']",
    placement: "right",
  },
  {
    id: "actions",
    title: "Построить график",
    text: "Нажмите «Построить график», чтобы отобразить зависимости. «Сбросить» очищает выбор и поле графика.",
    selector: "[data-tour='compare-props-actions']",
    placement: "right",
  },
  {
    id: "chart",
    title: "Поле графика",
    text: "Здесь строятся кривые «свойство — температура» для выбранных материалов: линии, легенда и подписи.",
    selector: "[data-tour='compare-props-chart']",
    placement: "left",
  },
  {
    id: "toolbar",
    title: "Инструменты графика",
    text: "Справа от графика: исходный масштаб, перемещение, рамка зума, приближение/отдаление и сохранение в PNG или SVG. Активны после построения графика.",
    selector: "[data-tour='compare-props-toolbar']",
    placement: "left",
    paddingX: 10,
    paddingY: 14,
  },
];
