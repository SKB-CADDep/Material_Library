import type { TourStep } from "../components/TabTour";

/** Пошаговое обучение вкладки «Подбор по температуре». */
export const TEMP_SELECTION_TOUR_STEPS: TourStep[] = [
  {
    id: "prop-type",
    title: "Тип свойств",
    text: "Выберите, какие свойства искать: физические или механические.",
    selector: "[data-tour='temp-prop-type']",
    placement: "bottom",
  },
  {
    id: "area",
    title: "Область применения",
    text: "Отфильтруйте список материалов по области применения (например, «Все» — полный пул).",
    selector: "[data-tour='temp-area']",
    placement: "right",
  },
  {
    id: "temperature",
    title: "Температура",
    text: "Введите температуру, при которой нужно подобрать материал. Обновление результатов идёт с небольшой задержкой.",
    selector: "[data-tour='temp-temperature']",
    placement: "bottom",
  },
  {
    id: "ntd",
    title: "Фильтр по НТД",
    text: "Фильтр по нормативно-техническому документу находится в заголовке колонки «НТД».",
    selector: "[data-tour='temp-ntd']",
    placement: "bottom",
    geometryDelay: 50,
  },
  {
    id: "units",
    title: "Единицы измерения",
    text: "ПКМ по заголовку столбца — смена единиц измерения для данных.",
    selector: ".column-unit-context-menu",
    placement: "top",
    geometryDelay: 500,
    onEnter: () => {
      const tableRoot =
        document.querySelector("[data-tour='temp-table']") ?? document.body;

      let attempt = 0;
      const maxAttempts = 12;

      const tryOpen = () => {
        attempt += 1;
        const menuEl = document.querySelector(
          ".column-unit-context-menu",
        ) as HTMLElement | null;
        if (menuEl) {
          return;
        }

        const header = tableRoot.querySelector(
          "th.calculation-table-col--unit-switch",
        ) as HTMLElement | null;

        if (header) {
          const r = header.getBoundingClientRect();
          const x = r.left + r.width * 0.5;
          const y = r.top + r.height * 0.5;
          const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            view: window,
          });
          header.dispatchEvent(event);
        }

        if (attempt < maxAttempts) {
          window.setTimeout(tryOpen, 90);
        }
      };

      tryOpen();
    },
  },
  {
    id: "table",
    title: "Результаты",
    text: "Здесь отображаются строки материалов с выбранными свойствами для указанной температуры.",
    selector: "[data-tour='temp-table']",
    placement: "top",
    geometryDelay: 150,
  },
];

