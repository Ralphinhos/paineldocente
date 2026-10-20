import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tooltipPosition, type ChartTooltipContent } from '@/lib/chartTooltip';

interface Props {
  id: string;
  active: { content: ChartTooltipContent; anchor: { x: number; y: number } } | null;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function ChartTooltip({ id, active, onPointerEnter, onPointerLeave }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 300, height: 200 });
  useEffect(() => {
    if (!active || !element.current) return;
    const rect = element.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, [active]);
  if (!active || typeof document === 'undefined') return null;
  const position = tooltipPosition(active.anchor, size, { width: window.innerWidth, height: window.innerHeight });
  return createPortal(<div ref={element} id={id} role="tooltip" className="ned-chart-tooltip" style={position} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
    <strong>{active.content.title}</strong>
    <dl>{active.content.lines.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl>
    {active.content.hint && <p>{active.content.hint}</p>}
  </div>, document.body);
}
