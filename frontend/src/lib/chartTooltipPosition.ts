export type RectBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PointTooltipPositionInput = {
  anchorX: number;
  anchorY: number;
  tipWidth: number;
  tipHeight: number;
  containerWidth: number;
  containerHeight: number;
  plotArea?: RectBounds;
  offset?: number;
};

export function computePointTooltipPosition(
  input: PointTooltipPositionInput,
): { x: number; y: number } {
  const offset = input.offset ?? 10;
  const plot = input.plotArea;
  const minX = plot?.left ?? 0;
  const minY = plot?.top ?? 0;
  const maxRight = plot ? plot.left + plot.width : input.containerWidth;
  const maxBottom = plot ? plot.top + plot.height : input.containerHeight;

  let x = input.anchorX + offset;
  let y = input.anchorY + offset;

  if (x + input.tipWidth > maxRight) {
    x = input.anchorX - input.tipWidth - offset;
  }
  if (y + input.tipHeight > maxBottom) {
    y = input.anchorY - input.tipHeight - offset;
  }

  const clampMaxX = Math.max(minX, maxRight - input.tipWidth);
  const clampMaxY = Math.max(minY, maxBottom - input.tipHeight);
  x = Math.min(Math.max(x, minX), clampMaxX);
  y = Math.min(Math.max(y, minY), clampMaxY);

  return { x, y };
}
