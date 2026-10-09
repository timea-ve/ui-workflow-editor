import type { KitItemDef } from '../types';
import { SketchRect } from '../../design/primitives';
import { Lines, SkeletonLine, TextRow, splitList, toBool, toInt } from './_helpers';

type TableProps = { columns: string; rows: number; showHeader: boolean };

const ROW_H = 32;
const MIN_COL_W = 48;

export const table: KitItemDef<TableProps> = {
  type: 'table',
  label: 'Table',
  category: 'wireframe',
  group: 'content',
  keywords: ['table', 'grid', 'data', 'spreadsheet', 'rows', 'columns'],
  defaultSize: { w: 327, h: 160 },
  minSize: { w: 80, h: 40 },
  resize: 'both',
  defaultProps: { columns: 'Name, Status, Date', rows: 4, showHeader: true },
  textProp: 'columns',
  editableProps: [
    { key: 'columns', label: 'Columns', kind: 'items', bar: 'inline' },
    { key: 'rows', label: 'Rows', kind: 'number', bar: 'inline' },
    { key: 'showHeader', label: 'Header row', kind: 'boolean' },
  ],
  linkable: false,
  render: (p, { w, h, style, seed }) => {
    const allCols = splitList(p.columns);
    const cols = (allCols.length ? allCols : ['Column']).slice(0, Math.max(1, Math.floor(w / MIN_COL_W)));
    const header = toBool(p.showHeader);
    const fit = Math.max(1, Math.floor(h / ROW_H));
    const bodyRows = Math.max(0, Math.min(toInt(p.rows, 4, 0, 100), fit - (header ? 1 : 0)));
    const total = (header ? 1 : 0) + bodyRows || 1;
    const th = Math.min(h, total * ROW_H);
    const rowH = th / total;
    const cw = w / cols.length;
    const grid: [number, number][][] = [];
    for (let r = 1; r < total; r++) grid.push([[0, r * rowH], [w, r * rowH]]);
    for (let c = 1; c < cols.length; c++) grid.push([[c * cw, 0], [c * cw, th]]);
    return (
      <>
        {header && <SketchRect w={w} h={rowH} style={style} seed={seed + 2} stroke="none" fill="faint" />}
        <SketchRect w={w} h={th} style={style} seed={seed} />
        {grid.length > 0 && <Lines w={w} h={th} lines={grid} style={style} seed={seed + 1} stroke="muted" strokeWidth={1} />}
        {header && cols.map((c, i) => <TextRow key={i} x={i * cw + 8} w={cw - 16} h={rowH} size="sm" weight={700}>{c}</TextRow>)}
        {Array.from({ length: bodyRows }, (_, r) =>
          cols.map((_, c) => (
            <SkeletonLine key={`${r}-${c}`} x={c * cw + 8} y={((header ? 1 : 0) + r + 0.5) * rowH} w={(cw - 16) * (0.5 + ((r + c) % 3) * 0.2)} style={style} seed={seed + 10 + r * 7 + c} />
          )),
        )}
      </>
    );
  },
  describe: (p) => {
    const cols = splitList(p.columns);
    return `Table with ${cols.length} column${cols.length === 1 ? '' : 's'} (${cols.join(', ')}) and ${toInt(p.rows, 4, 0, 100)} rows`;
  },
};
