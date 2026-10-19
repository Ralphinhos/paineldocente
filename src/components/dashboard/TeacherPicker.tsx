import { Search, X } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';

interface Props { value: string; options: Array<{ value: string; label: string }>; disabled: boolean; onChange: (id: string) => void }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function TeacherPicker({ value, options, disabled, onChange }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value)?.label || '';
  const matches = options.filter((option) => normalize(option.label).includes(normalize(search))).slice(0, 30);
  const choose = (next: string) => { onChange(next); setOpen(false); setSearch(''); };
  const navigate = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive((current) => open ? Math.max(0, Math.min(matches.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))) : 0); }
    if (event.key === 'Enter' && open && matches[active]) { event.preventDefault(); choose(matches[active].value); }
  };
  return <div className="teacher-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="sr-only" htmlFor={id}>Buscar e selecionar docente</label><Search size={18} aria-hidden="true" />
    <input ref={input} id={id} type="text" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-options'} aria-activedescendant={open && matches[active] ? id + '-option-' + active : undefined} autoComplete="off" placeholder="Buscar por nome do docente…" disabled={disabled} value={open ? search : selected} onFocus={() => { setOpen(true); setSearch(''); setActive(0); }} onChange={(event) => { setSearch(event.target.value); setActive(0); setOpen(true); }} onKeyDown={navigate} />
    {value && <button className="teacher-picker-clear" type="button" disabled={disabled} aria-label="Mostrar todos os docentes" onClick={() => choose('')}><X size={15} /></button>}
    {open && <ul id={id + '-options'} className="teacher-picker-options" role="listbox" aria-label="Docentes">{matches.map((option, index) => <li key={option.value} role="presentation"><button id={id + '-option-' + index} type="button" role="option" tabIndex={-1} aria-selected={option.value === value} className={index === active ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)}>{option.label}<small>ID {option.value}</small></button></li>)}{!matches.length && <li role="presentation" className="teacher-picker-empty">Nenhum docente encontrado.</li>}{matches.length === 30 && <li role="presentation" className="teacher-picker-empty">Digite mais letras para refinar.</li>}</ul>}
  </div>;
}
