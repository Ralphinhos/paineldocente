export interface ChartTooltipContent {
  title: string;
  lines: Array<{ label: string; value: string }>;
  hint?: string;
}

export function tooltipPosition(anchor: { x: number; y: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const gap = 12;
  const left = Math.max(gap, Math.min(anchor.x + gap, viewport.width - size.width - gap));
  const below = anchor.y + gap;
  const top = below + size.height <= viewport.height - gap ? below : Math.max(gap, anchor.y - size.height - gap);
  return { left, top };
}
