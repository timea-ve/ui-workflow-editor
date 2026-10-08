import type { KitItemDef } from '../types';
import { Box, KitText, SketchRect } from '../../design/primitives';
import { At, IconGlyph, MultilineText, TextRow, toBool } from './_helpers';

type ModalProps = { title: string; body: string; primary: string; secondary: string; showClose: boolean };

const PAD = 16;
const TITLE_H = 28;
const BTN_H = 36;

export const modal: KitItemDef<ModalProps> = {
  type: 'modal',
  label: 'Modal',
  category: 'wireframe',
  keywords: ['modal', 'dialog', 'popup', 'alert', 'confirm', 'sheet', 'overlay'],
  defaultSize: { w: 311, h: 220 },
  minSize: { w: 120, h: 72 },
  resize: 'both',
  defaultProps: {
    title: 'Delete project?',
    body: 'This will permanently remove the project and all of its screens.',
    primary: 'Delete',
    secondary: 'Cancel',
    showClose: true,
  },
  textProp: 'title',
  editableProps: [
    { key: 'title', label: 'Title', kind: 'text' },
    { key: 'body', label: 'Body', kind: 'multiline' },
    { key: 'primary', label: 'Primary button', kind: 'text' },
    { key: 'secondary', label: 'Secondary button (empty = hide)', kind: 'text' },
    { key: 'showClose', label: 'Show close button', kind: 'boolean' },
  ],
  linkable: true,
  render: (p, { w, h, style, seed }) => {
    const close = toBool(p.showClose) && w >= 100 ? 20 : 0;
    const showButtons = !!p.primary && h >= PAD + TITLE_H + BTN_H + PAD;
    const by = h - PAD - BTN_H;
    const bodyY = PAD + TITLE_H + 4;
    const bodyH = (showButtons ? by - 12 : h - PAD) - bodyY;
    const buttons = [p.secondary && { label: p.secondary, primary: false }, { label: p.primary, primary: true }].filter(Boolean) as { label: string; primary: boolean }[];
    const gap = 8;
    const bw = Math.min(120, (w - PAD * 2 - gap * (buttons.length - 1)) / buttons.length);
    return (
      <>
        <SketchRect w={w} h={h} radius={12} style={style} seed={seed} fill="surface" strokeWidth={2} />
        <TextRow x={PAD} y={PAD} w={w - PAD * 2 - (close ? close + 8 : 0)} h={Math.min(TITLE_H, h - PAD * 2)} size="lg" weight={700}>{p.title}</TextRow>
        {close > 0 && <IconGlyph glyph="close" x={w - PAD - close} y={PAD + (TITLE_H - close) / 2} size={close} style={style} seed={seed + 3} tone="muted" />}
        {bodyH >= 14 && p.body && (
          <Box x={PAD} y={bodyY} w={w - PAD * 2} h={bodyH} style={{ overflow: 'hidden' }}>
            <MultilineText h={bodyH} size="sm" tone="muted">{p.body}</MultilineText>
          </Box>
        )}
        {showButtons && buttons.map((b, i) => {
          const x = w - PAD - (buttons.length - i) * bw - (buttons.length - 1 - i) * gap;
          return (
            <At key={i} x={x} y={by} w={bw} h={BTN_H}>
              <SketchRect w={bw} h={BTN_H} radius={6} style={style} seed={seed + 10 + i} fill={b.primary ? 'faint' : 'none'} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 8px' }}>
                <KitText align="center" weight={b.primary ? 700 : 400}>{b.label}</KitText>
              </div>
            </At>
          );
        })}
      </>
    );
  },
  describe: (p) => `Modal '${p.title}' with ${[p.primary, p.secondary].filter(Boolean).map((b) => `'${b}'`).join(' and ')} button${p.secondary ? 's' : ''}`,
};
