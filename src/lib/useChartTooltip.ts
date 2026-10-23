import { useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import type { ChartTooltipContent } from './chartTooltip';

export function useChartTooltip() {
  const id = useId();
  const [active, setActive] = useState<{ key: string; content: ChartTooltipContent; anchor: { x: number; y: number } } | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const keepOpen = () => clearTimeout(timeout.current);
  const hide = () => { clearTimeout(timeout.current); setActive(null); };
  const leave = () => { clearTimeout(timeout.current); timeout.current = setTimeout(() => setActive(null), 140); };
  useEffect(() => () => clearTimeout(timeout.current), []);
  useEffect(() => {
    if (!active) return;
    const dismiss = () => setActive(null);
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      document.removeEventListener('keydown', escape);
    };
  }, [active]);
  const bind = (key: string, content: ChartTooltipContent) => ({
    'aria-describedby': active?.key === key ? id : undefined,
    onPointerEnter: (event: PointerEvent<Element>) => { keepOpen(); setActive({ key, content, anchor: { x: event.clientX, y: event.clientY } }); },
    onPointerLeave: leave,
    onFocus: (event: FocusEvent<Element>) => {
      keepOpen();
      const rect = event.currentTarget.getBoundingClientRect();
      setActive({ key, content, anchor: { x: rect.left + Math.min(rect.width / 2, 240), y: rect.bottom } });
    },
    onBlur: hide,
    onClick: hide,
  });
  return { bind, hide, props: { id, active, onPointerEnter: keepOpen, onPointerLeave: leave } };
}
