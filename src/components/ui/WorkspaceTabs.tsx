import type { KeyboardEvent } from 'react';
interface Tab { id: string; label: string; count?: number }
interface Props { id: string; label: string; tabs: Tab[]; value: string; onChange: (value: string) => void; locked?: boolean; compact?: boolean }
// Adapted from Cult UI's direction-aware tabs. See docs/UI_REFERENCIAS.md.
export function WorkspaceTabs({ id, label, tabs, value, onChange, locked = false, compact = false }: Props) {
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (locked) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus();
  };
  return <div className={'workspace-tabs' + (compact ? ' tabs-compact' : '')} role="tablist" aria-label={label}>
    {tabs.map((tab, index) => <button key={tab.id} id={id + '-tab-' + tab.id} type="button" role="tab" aria-selected={value === tab.id} aria-controls={id + '-panel-' + tab.id} tabIndex={value === tab.id ? 0 : -1} disabled={locked && value !== tab.id} onClick={() => onChange(tab.id)} onKeyDown={(event) => navigate(event, index)}>
      {tab.label}{tab.count != null && tab.count > 0 && <span className="tab-count">{tab.count}</span>}
    </button>)}
  </div>;
}
