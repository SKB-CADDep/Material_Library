import type { TourStep } from "../components/TabTour";

/** Пошаговое обучение вкладки «Ларсон–Миллер». */
export const LARSON_MILLER_TOUR_STEPS: TourStep[] = [
  {
    id: "material",
    title: "Материал",
    text: "Выберите материал — после этого станет доступен базовый срок службы. Константа C берётся из «Общих данных» материала.",
    selector: "[data-tour='lm-material']",
    placement: "bottom",
  },
  {
    id: "constant-c",
    title: "Константа C",
    text: "C берётся из «Общих данных» материала (редактор → Общие данные). На вкладке она только показывается — без C график не построится.",
    selector: "[data-tour='lm-constant-c']",
    placement: "bottom",
  },
  {
    id: "hours",
    title: "Базовый срок службы",
    text: "Выберите срок из списка (10 000–250 000 ч) или пункт «Другое» — тогда появится поле для ввода своего значения.",
    selector: "[data-tour='lm-hours']",
    placement: "bottom",
  },
  {
    id: "table",
    title: "Таблица расчёта",
    text: "Столбцы «Табличные данные» заполняются из базы. В «Расчетных данных» можно менять только срок службы и температуру — предел длительной прочности и P рассчитываются автоматически.",
    selector: "[data-tour='lm-table']",
    placement: "top",
  },
  {
    id: "chart",
    title: "График σдп(P)",
    text: "Синяя линия — кривая по табличным точкам, красная точка — расчётные данные. Константа C задаётся в «Общих данных» материала.",
    selector: "[data-tour='lm-chart']",
    placement: "top",
  },
];
