import type { KitItemDef } from '../types';

type HotspotProps = { label: string };

// Marks what the user taps, in place: a lime wash with an ink outline (the app's hover look),
// laid over the real control. Prototype links start from it. Stays see-through so the UI underneath reads.
export const hotspot: KitItemDef<HotspotProps> = {
  type: 'hotspot',
  label: 'Tap highlight',
  category: 'wireframe',
  group: 'actions',
  keywords: ['tap', 'click', 'hotspot', 'highlight', 'overlay', 'touch', 'interaction', 'tap target'],
  defaultSize: { w: 120, h: 40 },
  minSize: { w: 8, h: 8 },
  resize: 'both',
  defaultProps: { label: '' },
  editableProps: [{ key: 'label', label: 'What is tapped', kind: 'text' }],
  linkable: true,
  render: (_p, { w, h }) => {
    const r = Math.min(6, w / 2, h / 2);
    return (
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
        <rect
          x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={r} ry={r}
          style={{ fill: 'color-mix(in srgb, var(--fs-accent-fill) 42%, transparent)', stroke: 'var(--fs-accent)', strokeWidth: 2 }}
        />
      </svg>
    );
  },
  describe: (p) => (p.label ? `Tap highlight on '${p.label}'` : 'Tap highlight'),
};
