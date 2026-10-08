import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Download, LoaderCircle } from 'lucide-react';
import type { BoardDoc, ID } from '../model/types';
import { Toasts, type ToastMessage } from '../chrome/Toast';
import { ICON_STROKE } from '../chrome/shared';
import { downloadBlob, exportBoard, ExportError } from './exportBoard';
import { exportFileName, scopeLabel, type ExportBackground, type ExportFormat, type ExportScope } from './scope';
import './export.css';

export interface ExportPrefs { scope: ExportScope; format: ExportFormat; background: ExportBackground }

const PREFS_KEY = 'fs:export:v1';
const DEFAULT_PREFS: ExportPrefs = { scope: 'board', format: 'png', background: 'white' };

export function loadExportPrefs(): ExportPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<ExportPrefs>;
    return {
      scope: p.scope === 'selection' || p.scope === 'option' || p.scope === 'board' ? p.scope : DEFAULT_PREFS.scope,
      format: p.format === 'pdf' || p.format === 'png' ? p.format : DEFAULT_PREFS.format,
      background: p.background === 'transparent' || p.background === 'white' ? p.background : DEFAULT_PREFS.background,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveExportPrefs(p: ExportPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage full/blocked: not critical */ }
}

/** The remembered scope may not be available right now (no selection, no option) → fall back to the whole board. */
export function effectiveScope(scope: ExportScope, hasSelection: boolean, hasOption: boolean): ExportScope {
  if (scope === 'selection' && !hasSelection) return 'board';
  if (scope === 'option' && !hasOption) return 'board';
  return scope;
}

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: BoardDoc;
  title: string;
  selectionIds?: ID[];
  currentVariantId?: ID;
  /** Limit the formats offered (the share view offers PNG only). Default: both. */
  formats?: ExportFormat[];
  /** Host-provided toast; when omitted the dialog shows its own. */
  notify?: (message: string) => void;
}

type Status = { kind: 'idle' } | { kind: 'working' } | { kind: 'error'; message: string };

export function ExportDialog({ open, onOpenChange, doc, title, selectionIds, currentVariantId, formats = ['png', 'pdf'], notify }: ExportDialogProps) {
  const hasSelection = !!selectionIds?.length;
  const hasOption = !!currentVariantId && !!doc.variants[currentVariantId];
  const [prefs, setPrefs] = useState<ExportPrefs>(loadExportPrefs);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const run = useRef(0);

  const scope = effectiveScope(prefs.scope, hasSelection, hasOption);
  const format: ExportFormat = formats.includes(prefs.format) ? prefs.format : formats[0];
  const background: ExportBackground = format === 'pdf' ? 'white' : prefs.background;

  useEffect(() => { if (open) setStatus({ kind: 'idle' }); }, [open]);

  const toast = useCallback((message: string) => {
    if (notify) notify(message);
    else setToasts((t) => [...t, { id: `${Date.now()}-${Math.random()}`, message }]);
  }, [notify]);

  const update = (patch: Partial<ExportPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveExportPrefs(next);
  };

  const doExport = async () => {
    const token = ++run.current;
    setStatus({ kind: 'working' });
    try {
      const blob = await exportBoard({ doc, title, scope, selectionIds, variantId: currentVariantId, format, background });
      if (token !== run.current) return; // cancelled
      const name = exportFileName(title, scopeLabel(doc, scope, currentVariantId), format);
      downloadBlob(blob, name);
      saveExportPrefs(prefs);
      setStatus({ kind: 'idle' });
      onOpenChange(false);
      toast(`Exported “${name}”`);
    } catch (e) {
      if (token !== run.current) return;
      const message = e instanceof ExportError && e.kind === 'empty'
        ? e.message
        : `Export didn’t work this time. Try again${scope === 'board' ? ', or export a selection if the board is very large' : ''}.`;
      setStatus({ kind: 'error', message });
      toast('Export failed');
    }
  };

  const cancel = () => {
    run.current++;
    setStatus({ kind: 'idle' });
    onOpenChange(false);
  };

  const working = status.kind === 'working';

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : cancel())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fsc-overlay" />
          <Dialog.Content className="fs-dialog fsc-float fsc-root" data-kit-style="clean" aria-busy={working || undefined}>
            <Dialog.Title className="fs-dialog__title">Export</Dialog.Title>
            <Dialog.Description className="fs-dialog__desc">Save a picture of your board to share or print.</Dialog.Description>
            <div className="fs-dialog__body">
              <Choice legend="What" name="scope" value={scope} onChange={(v) => update({ scope: v as ExportScope })} disabled={working}
                options={[
                  { value: 'board', label: 'Whole board' },
                  { value: 'selection', label: 'Selection', disabled: !hasSelection, hint: hasSelection ? undefined : 'Select something first' },
                  ...(currentVariantId ? [{ value: 'option', label: hasOption ? doc.variants[currentVariantId].label : 'Current option', disabled: !hasOption }] : []),
                ]}
                hint={!hasSelection ? 'Select screens on the board to export just those.' : undefined} />
              {formats.length > 1 && (
                <Choice legend="Format" name="format" value={format} onChange={(v) => update({ format: v as ExportFormat })} disabled={working}
                  options={formats.map((f) => ({ value: f, label: f === 'png' ? 'Image (PNG)' : 'Document (PDF)' }))} />
              )}
              <Choice legend="Background" name="background" value={background} onChange={(v) => update({ background: v as ExportBackground })}
                disabled={working}
                options={[
                  { value: 'white', label: 'White' },
                  { value: 'transparent', label: 'Transparent', disabled: format === 'pdf' },
                ]}
                hint={format === 'pdf' ? 'PDFs always have a white background.' : undefined} />
            </div>
            {status.kind === 'error' && (
              <p className="fs-dialog__error" role="alert">
                <AlertCircle size={16} strokeWidth={ICON_STROKE} aria-hidden /> {status.message}
              </p>
            )}
            <div className="fs-dialog__foot">
              <button type="button" className="fsc-btn fsc-btn--outline" onClick={cancel}>Cancel</button>
              <button type="button" className="fsc-btn fsc-btn--primary" onClick={doExport} disabled={working} aria-live="polite">
                {working
                  ? <><LoaderCircle size={16} strokeWidth={ICON_STROKE} className="fsc-spin" aria-hidden /> Exporting…</>
                  : <><Download size={16} strokeWidth={ICON_STROKE} aria-hidden /> {status.kind === 'error' ? 'Try again' : 'Export'}</>}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!notify && <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />}
    </>
  );
}

function Choice({ legend, name, value, options, onChange, disabled, hint }: {
  legend: string; name: string; value: string; disabled?: boolean; hint?: ReactNode;
  options: { value: string; label: string; disabled?: boolean; hint?: string }[];
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <fieldset className="fs-choice" disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend>{legend}</legend>
      <div className="fs-choice__row">
        {options.map((o) => (
          <label key={o.value} className="fs-choice__opt" title={o.hint}>
            <input type="radio" name={`${id}-${name}`} value={o.value} checked={value === o.value} disabled={o.disabled}
              onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p id={`${id}-hint`} className="fs-choice__hint">{hint}</p>}
    </fieldset>
  );
}

/** Cmd/Ctrl+Shift+E → `open()`. The Orchestrator wires this in the editor. */
export function useExportShortcut(open: () => void, enabled = true) {
  const cb = useRef(open);
  useEffect(() => { cb.current = open; }, [open]);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isExportShortcut(e)) {
        e.preventDefault();
        cb.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function isExportShortcut(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>) {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e';
}
