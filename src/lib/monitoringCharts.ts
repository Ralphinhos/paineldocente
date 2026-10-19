// Integer axes start at zero. Unknown values must remain distinct from measured zeroes.
export type ChartTone = 'blue' | 'green' | 'rose' | 'amber' | 'orange' | 'yellow' | 'purple' | 'slate';
export const CHART_COLORS: Record<ChartTone, string> = { blue: '#3694ff', green: '#18ad72', rose: '#f04461', amber: '#f7a923', orange: '#fb8a25', yellow: '#ffc632', purple: '#8b5cf6', slate: '#a0aec0' };
export const formatPercent = (value: number | null) => value == null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

export function donutSegments(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  let offset = 0;
  return values.map((value) => {
    const share = total ? value / total : 0;
    const segment = { value, share, offset };
    offset += share;
    return segment;
  });
}

export function integerScale(values: Array<number | null>) {
  const maximum = Math.max(0, ...values.filter((value): value is number => value != null && Number.isFinite(value) && value >= 0));
  const rough = Math.max(1, maximum / 5);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough)!;
  const ceiling = Math.max(step, Math.ceil(maximum / step) * step);
  return { ceiling, ticks: Array.from({ length: Math.round(ceiling / step) + 1 }, (_, index) => index * step) };
}

export function chartLabel(label: string, width = 18): [string, string] {
  const words = label.trim().split(/\s+/);
  let first = words.shift() || '';
  while (words.length && first.length + words[0].length + 1 <= width) first += ' ' + words.shift();
  const shorten = (text: string) => text.length > width ? text.slice(0, width - 1) + '…' : text;
  return [shorten(first), shorten(words.join(' '))];
}
