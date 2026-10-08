export interface OptionChipProps {
  /** Short label, e.g. "A". */
  letter: string;
  /** Optional rename, e.g. "Social login". */
  name?: string;
  /** Free-text option label (e.g. "Option B – short form"); replaces "Option {letter} · {name}". */
  label?: string;
  /** Highlight (e.g. the option shown in a Compare pane or being played). */
  active?: boolean;
  /** Makes the chip a button (e.g. select the whole option / open its menu). */
  onClick?: () => void;
  /** Use "radio" inside a radiogroup (option pickers). */
  role?: 'radio';
}

/** Label chip for an option lane: "Option A · Social login". */
export function OptionChip({ letter, name, label, active, onClick, role }: OptionChipProps) {
  const content = (
    <>
      <span className="fsc-chip__letter" aria-hidden>{letter}</span>
      {label ? <span>{label}</span> : <span>Option {letter}</span>}
      {!label && name && <span className="fsc-chip__name">· {name}</span>}
    </>
  );
  const a11y = label ?? `Option ${letter}${name ? ` – ${name}` : ''}`;
  if (!onClick) return <span className="fsc-chip fsc-root" data-active={active || undefined} aria-label={a11y} role="img">{content}</span>;
  const state = role === 'radio' ? { role, 'aria-checked': !!active } : { 'aria-pressed': active };
  return (
    <button type="button" className="fsc-chip fsc-root" data-active={active || undefined} aria-label={a11y} onClick={onClick} {...state}>
      {content}
    </button>
  );
}
