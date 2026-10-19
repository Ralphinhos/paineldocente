// Integer axes start at zero. Unknown values must remain distinct from measured zeroes.
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
