import { useId, type ReactNode } from 'react';
import type { PropField } from '../kit/types';

export interface InspectorSelection {
  /** Kind of thing selected, e.g. "Button" or "Screen". */
  kind: string;
  /** Human name, e.g. "Sign up". */
  title: string;
  fields: PropField[];
  values: Record<string, unknown>;
}

export interface InspectorProps {
  selection: InspectorSelection | null;
  onChange: (key: string, value: unknown) => void;
  /** Extra sections below the fields (e.g. Link, Option). Use <InspectorSection>. */
  children?: ReactNode;
  /** Shown when several items are selected. Children still render (e.g. align / distribute). */
  multiCount?: number;
  /** Render as an <aside> landmark (default). Set false when the host already provides the landmark. */
  landmark?: boolean;
  className?: string;
}

/** Right-hand side panel: editable lo-fi props of the current selection. */
export function Inspector({ selection, onChange, children, multiCount, landmark = true, className }: InspectorProps) {
  const Root = landmark ? 'aside' : 'div';
  return (
    <Root className={`fsc-inspector fsc-root${className ? ` ${className}` : ''}`} {...(landmark ? { 'aria-label': 'Inspector' } : {})}>
      {multiCount && multiCount > 1 ? (
        <>
          <p className="fsc-inspector__empty">{multiCount} items selected. Select one item to edit its details.</p>
          {children}
        </>
      ) : !selection ? (
        <p className="fsc-inspector__empty">Select something on the canvas to edit it here.</p>
      ) : (
        <>
          <div className="fsc-inspector__head">
            <p className="fsc-inspector__kind">{selection.kind}</p>
            <h2 className="fsc-inspector__title">{selection.title}</h2>
          </div>
          <div className="fsc-inspector__body">
            {selection.fields.map((f) => (
              <Field key={f.key} field={f} value={selection.values[f.key]} onChange={(v) => onChange(f.key, v)} />
            ))}
          </div>
          {children}
        </>
      )}
    </Root>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="fsc-inspector__section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

function Field({ field, value, onChange }: { field: PropField; value: unknown; onChange: (v: unknown) => void }) {
  const id = useId();
  if (field.kind === 'boolean') {
    return (
      <label className="fsc-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  let control: ReactNode;
  switch (field.kind) {
    case 'multiline':
      control = <textarea id={id} className="fsc-textarea" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      control = (
        <select id={id} className="fsc-select" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'number':
      control = (
        <input id={id} className="fsc-input" type="number" inputMode="numeric" value={Number(value ?? 0)}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
      );
      break;
    default:
      control = <input id={id} className="fsc-input" type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className="fsc-field">
      <label className="fsc-field__label" htmlFor={id}>{field.label}</label>
      {control}
    </div>
  );
}
