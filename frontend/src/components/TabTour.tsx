import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export type TourPlacement = "auto" | "right" | "left" | "top" | "bottom";

export type TourStep = {
  id: string;
  title: string;
  text: string;
  /** CSS-селектор целевого элемента. */
  selector: string;
  placement?: TourPlacement;
  /** Равномерный отступ вокруг цели (если не заданы paddingX/paddingY). */
  padding?: number;
  /** Горизонтальный отступ подсветки (по умолчанию меньше вертикального). */
  paddingX?: number;
  /** Вертикальный отступ подсветки — «длиннее», без расширения по ширине. */
  paddingY?: number;
  /** Задержка перед измерением геометрии (мс), если UI ещё перестраивается. */
  geometryDelay?: number;
  /** Подготовка UI перед показом шага. */
  onEnter?: () => void;
};

export type TabTourProps = {
  open: boolean;
  steps: TourStep[];
  onClose: () => void;
};

type Rect = { left: number; top: number; width: number; height: number };

const CARD_WIDTH = 360;
const CARD_MARGIN = 14;
/** По умолчанию чуть длиннее по вертикали, почти без расширения по ширине. */
const DEFAULT_PADDING_X = 8;
const DEFAULT_PADDING_Y = 12;

function emptyRect(): Rect {
  return { left: 0, top: 0, width: 0, height: 0 };
}

function readTargetRect(
  selector: string,
  paddingX: number,
  paddingY: number,
): Rect | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement) || !el.isConnected) {
    return null;
  }
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    return null;
  }
  return {
    left: r.left - paddingX,
    top: r.top - paddingY,
    width: r.width + paddingX * 2,
    height: r.height + paddingY * 2,
  };
}

function fallbackRect(): Rect {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    left: w / 4,
    top: h / 4,
    width: w / 2,
    height: h / 2,
  };
}

function placeCard(
  highlight: Rect,
  cardW: number,
  cardH: number,
  placement: TourPlacement,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = CARD_MARGIN;

  const order: Array<"right" | "left" | "bottom" | "top"> =
    placement === "right"
      ? ["right", "bottom", "left", "top"]
      : placement === "left"
        ? ["left", "bottom", "right", "top"]
        : placement === "bottom"
          ? ["bottom", "right", "left", "top"]
          : placement === "top"
            ? ["top", "right", "bottom", "left"]
            : ["right", "bottom", "left", "top"];

  const trySide = (side: "right" | "left" | "bottom" | "top") => {
    let left = 0;
    let top = 0;
    if (side === "right") {
      left = highlight.left + highlight.width + margin;
      top = highlight.top + highlight.height / 2 - cardH / 2;
    } else if (side === "left") {
      left = highlight.left - margin - cardW;
      top = highlight.top + highlight.height / 2 - cardH / 2;
    } else if (side === "bottom") {
      left = highlight.left + highlight.width / 2 - cardW / 2;
      top = highlight.top + highlight.height + margin;
    } else {
      left = highlight.left + highlight.width / 2 - cardW / 2;
      top = highlight.top - margin - cardH;
    }
    left = Math.max(margin, Math.min(left, vw - cardW - margin));
    top = Math.max(margin, Math.min(top, vh - cardH - margin));
    const cardRect = { left, top, width: cardW, height: cardH };
    const pad = 8;
    const intersects =
      cardRect.left < highlight.left + highlight.width + pad &&
      cardRect.left + cardRect.width > highlight.left - pad &&
      cardRect.top < highlight.top + highlight.height + pad &&
      cardRect.top + cardRect.height > highlight.top - pad;
    return intersects ? null : { left, top };
  };

  for (const side of order) {
    const placed = trySide(side);
    if (placed) {
      return placed;
    }
  }
  return {
    left: Math.max(margin, (vw - cardW) / 2),
    top: Math.max(margin, vh - cardH - margin - 8),
  };
}

/**
 * Полноэкранный пошаговый тур с подсветкой элементов
 * (аналог OnboardingOverlay из Базы знаний).
 */
export function TabTour({ open, steps, onClose }: TabTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<Rect>(emptyRect);
  const [cardPos, setCardPos] = useState({ left: 0, top: 0 });

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const measure = useCallback(() => {
    if (!open || !step) {
      return;
    }
    const uniform = step.padding;
    const paddingX = step.paddingX ?? uniform ?? DEFAULT_PADDING_X;
    const paddingY = step.paddingY ?? uniform ?? DEFAULT_PADDING_Y;
    const rect =
      readTargetRect(step.selector, paddingX, paddingY) ?? fallbackRect();
    setHighlight(rect);
    const cardEl = document.getElementById("tab-tour-card");
    const cardW = cardEl?.offsetWidth || CARD_WIDTH;
    const cardH = cardEl?.offsetHeight || 160;
    setCardPos(placeCard(rect, cardW, cardH, step.placement ?? "auto"));
  }, [open, step]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      return;
    }
    if (steps.length === 0) {
      onClose();
    }
  }, [open, steps.length, onClose]);

  useLayoutEffect(() => {
    if (!open || !step) {
      return;
    }
    step.onEnter?.();
    const delay = step.geometryDelay ?? 50;
    const timer = window.setTimeout(measure, delay);
    return () => window.clearTimeout(timer);
  }, [open, step, stepIndex, measure]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, measure]);

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      onClose();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, steps.length, onClose]);

  const goBack = useCallback(() => {
    setStepIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "Backspace" || event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, goNext, goBack]);

  if (!open || !step || steps.length === 0) {
    return null;
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const hr = 8;
  const { left, top, width, height } = highlight;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 20000,
    pointerEvents: "auto",
  };

  return createPortal(
    <div
      className="tab-tour-overlay"
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tab-tour-title"
      onMouseDown={(event) => {
        const card = document.getElementById("tab-tour-card");
        if (card && card.contains(event.target as Node)) {
          return;
        }
        goNext();
      }}
    >
      <svg
        className="tab-tour-mask"
        width={vw}
        height={vh}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        aria-hidden
      >
        <path
          fillRule="evenodd"
          fill="rgba(0, 0, 0, 0.65)"
          d={[
            `M0 0H${vw}V${vh}H0Z`,
            `M${left + hr} ${top}`,
            `H${left + width - hr}`,
            `A${hr} ${hr} 0 0 1 ${left + width} ${top + hr}`,
            `V${top + height - hr}`,
            `A${hr} ${hr} 0 0 1 ${left + width - hr} ${top + height}`,
            `H${left + hr}`,
            `A${hr} ${hr} 0 0 1 ${left} ${top + height - hr}`,
            `V${top + hr}`,
            `A${hr} ${hr} 0 0 1 ${left + hr} ${top}Z`,
          ].join(" ")}
        />
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          rx={hr}
          ry={hr}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />
      </svg>

      <div
        id="tab-tour-card"
        className="tab-tour-card"
        style={{
          position: "fixed",
          left: cardPos.left,
          top: cardPos.top,
          width: CARD_WIDTH,
          maxWidth: `calc(100vw - ${CARD_MARGIN * 2}px)`,
          zIndex: 20001,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="tab-tour-title" className="tab-tour-card-title">
          {step.title}
        </h3>
        <p className="tab-tour-card-text">{step.text}</p>
        <div className="tab-tour-card-footer">
          <span className="tab-tour-card-counter">
            Шаг {stepIndex + 1} из {steps.length}
          </span>
          <div className="tab-tour-card-actions">
            <button
              type="button"
              className="tab-tour-btn tab-tour-btn--flat"
              onClick={onClose}
            >
              Пропустить
            </button>
            <button
              type="button"
              className="tab-tour-btn"
              onClick={goBack}
              disabled={stepIndex === 0}
            >
              Назад
            </button>
            <button
              type="button"
              className="tab-tour-btn tab-tour-btn--primary"
              onClick={goNext}
            >
              {isLast ? "Готово" : "Далее"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
