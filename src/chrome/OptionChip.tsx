export interface OptionChipProps {
  /** Short label, e.g. "A". */
  letter: string;
  /** Optional rename, e.g. "Social login". */
  name?: string;
  /** Highlight (e.g. the option shown in a Compare pane or being played). */
  active?: boolean;
  /** Makes the chip a button (e.g. select the whole option / open its menu). */
  onClick?: () => void;
}

/** Label chip for an option lane: "Option A · Social login". */
export function OptionChip({ letter, name, active, onClick }: OptionChipProps) {
  const content = (
    <>
      <span className="fsc-chip__letter" aria-hidden>{letter}</span>
      <span>Option {letter}</span>
      {name && <span className="fsc-chip__name">· {name}</span>}
    </>
  );
  const label = `Option ${letter}${name ? ` – ${name}` : ''}`;
  return onClick ? (
    <button type="button" className="fsc-chip fsc-root" data-active={active || undefined} aria-pressed={active} aria-label={label} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span className="fsc-chip fsc-root" data-active={active || undefined} aria-label={label} role="img">{content}</span>
  );
}
