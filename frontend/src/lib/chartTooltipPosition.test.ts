import { describe, expect, it } from "vitest";
import { computePointTooltipPosition } from "./chartTooltipPosition";

const plot = { left: 60, top: 20, width: 700, height: 400 };
const container = { width: 800, height: 480 };

describe("computePointTooltipPosition", () => {
  it("ставит плашку справа-снизу от точки, если помещается", () => {
    expect(
      computePointTooltipPosition({
        anchorX: 200,
        anchorY: 150,
        tipWidth: 180,
        tipHeight: 72,
        containerWidth: container.width,
        containerHeight: container.height,
        plotArea: plot,
        offset: 10,
      }),
    ).toEqual({ x: 210, y: 160 });
  });

  it("отражает влево у правого края плота", () => {
    const anchorX = plot.left + plot.width - 20;
    const tipWidth = 180;
    expect(
      computePointTooltipPosition({
        anchorX,
        anchorY: 150,
        tipWidth,
        tipHeight: 72,
        containerWidth: container.width,
        containerHeight: container.height,
        plotArea: plot,
        offset: 10,
      }),
    ).toEqual({ x: anchorX - tipWidth - 10, y: 160 });
  });

  it("отражает вверх у нижнего края плота", () => {
    const anchorY = plot.top + plot.height - 20;
    const tipHeight = 72;
    expect(
      computePointTooltipPosition({
        anchorX: 200,
        anchorY,
        tipWidth: 180,
        tipHeight,
        containerWidth: container.width,
        containerHeight: container.height,
        plotArea: plot,
        offset: 10,
      }),
    ).toEqual({ x: 210, y: anchorY - tipHeight - 10 });
  });

  it("клампит плашку в границы плота", () => {
    const tipWidth = 180;
    const tipHeight = 72;
    const result = computePointTooltipPosition({
      anchorX: plot.left + plot.width - 5,
      anchorY: plot.top + plot.height - 5,
      tipWidth,
      tipHeight,
      containerWidth: container.width,
      containerHeight: container.height,
      plotArea: plot,
      offset: 10,
    });
    expect(result.x).toBeGreaterThanOrEqual(plot.left);
    expect(result.y).toBeGreaterThanOrEqual(plot.top);
    expect(result.x + tipWidth).toBeLessThanOrEqual(plot.left + plot.width);
    expect(result.y + tipHeight).toBeLessThanOrEqual(plot.top + plot.height);
  });
});
