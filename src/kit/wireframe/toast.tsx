import type { KitItemDef } from '../types';
import { SketchEllipse, SketchRect } from '../../design/primitives';
import { At, IconAt, TextRow, toBool } from './_helpers';

type ToastKind = 'info' | 'success' | 'warning' | 'error';
type ToastProps = { kind: ToastKind; title: string; message: string; action: string; showClose: boolean };

const ICONS: Record<ToastKind, string> = { info: 'info', success: 'check', warning: 'alert', error: 'close' };
const PAD = 12;
const ICON = 24;

export const toast: KitItemDef<ToastProps> = {
  type: 'toast',
  label: 'Toast / alert',
  category: 'wireframe',
  group: 'feedback',
  keywords: ['toast', 'alert', 'banner', 'notification', 'snackbar', 'message', 'error', 'success', 'warning', 'info'],
  defaultSize: { w: 327, h: 64 },
  minSize: { w: 96, h: 36 },
  resize: 'both',
  defaultProps: { kind: 'success', title: 'Changes saved', message: 'Your profile is up to date.', action: 'Undo', showClose: true },
  textProp: 'title',
  editableProps: [
    { key: 'kind', label: 'Kind', kind: 'select', options: ['info', 'success', 'warning', 'error'], bar: 'inline' },
    { key: 'title', label: 'Title', kind: 'text', bar: 'inline' },
    { key: 'message', label: 'Message', kind: 'text', bar: 'more' },
    { key: 'action', label: 'Action (empty = hide)', kind: 'text', bar: 'more' },
    { key: 'showClose', label: 'Close button', kind: 'boolean', bar: 'more' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const kind: ToastKind = p.kind in ICONS ? p.kind : 'info';
    const strong = kind === 'error' || kind === 'warning';
    const icon = Math.min(ICON, h - 12);
    const filledIcon = kind === 'success' || kind === 'error';
    const close = toBool(p.showClose) && w >= 160 ? 16 : 0;
    const actionW = p.action && w >= 240 ? Math.min(80, p.action.length * 8 + 16) : 0;
    const right = w - PAD - (close ? close + 10 : 0) - (actionW ? actionW + 8 : 0);
    const tx = PAD + 4 + (icon >= 12 ? icon + 10 : 0);
    const two = !!p.message && h >= 52;
    return (
      <>
        <SketchRect w={w} h={h} radius={8} style={style} seed={seed} fill="surface" stroke="ink" strokeWidth={strong ? 2 : 1.5} />
        <At x={1} y={1} w={5} h={h - 2}>
          <SketchRect w={5} h={h - 2} radius={2} style={style} seed={seed + 1} stroke="none" fill={strong ? 'ink' : 'faint'} />
        </At>
        {icon >= 12 && (
          <At x={PAD + 4} y={(h - icon) / 2} w={icon} h={icon}>
            {filledIcon && <SketchEllipse w={icon} h={icon} style={style} seed={seed + 2} fill="ink" />}
            <IconAt name={ICONS[kind]} x={filledIcon ? icon * 0.2 : 0} y={filledIcon ? icon * 0.2 : 0} size={filledIcon ? icon * 0.6 : icon} tone={filledIcon ? 'surface' : 'ink'} strokeWidth={filledIcon ? 2.5 : 2} />
          </At>
        )}
        {two ? (
          <>
            <TextRow x={tx} y={h / 2 - 19} w={right - tx} h={20} weight={700}>{p.title}</TextRow>
            <TextRow x={tx} y={h / 2 + 1} w={right - tx} h={18} size="sm" tone="muted">{p.message}</TextRow>
          </>
        ) : (
          <TextRow x={tx} w={right - tx} h={h} weight={700}>{p.title}</TextRow>
        )}
        {actionW > 0 && (
          <TextRow x={w - PAD - (close ? close + 10 : 0) - actionW} w={actionW} h={h} align="right" weight={700}>
            <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>{p.action}</span>
          </TextRow>
        )}
        {close > 0 && <IconAt name="close" x={w - PAD - close} y={(h - close) / 2} size={close} tone="muted" />}
      </>
    );
  },
  describe: (p) => `${p.kind && p.kind in ICONS ? p.kind[0].toUpperCase() + p.kind.slice(1) : 'Info'} toast '${p.title}'${p.message ? `: ${p.message}` : ''}${p.action ? `, action '${p.action}'` : ''}`,
};
