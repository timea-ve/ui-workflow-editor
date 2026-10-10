import type { KitItemDef, KitItemRect } from '../types';
import { KitText, SketchEllipse, SketchRect } from '../../design/primitives';
import { At, IconAt, IconGlyph, TextRow, splitList, toBool } from './_helpers';

type HeaderProps = {
  title: string;
  leading: 'back' | 'menu' | 'none';
  action: 'none' | 'search' | 'user' | 'more';
  /** 'app' = mobile app bar (default, back-compat); 'web' = desktop top navigation. */
  variant: 'app' | 'web';
  links: string;
  search: boolean;
  right: 'avatar' | 'button' | 'none';
  cta: string;
};

const ICON = 24;
const PAD = 12;

function renderApp(p: HeaderProps, w: number, h: number, style: 'sketchy' | 'clean', seed: number) {
  const size = Math.min(ICON, h - 12);
  const iy = (h - size) / 2;
  const hasLead = p.leading === 'back' || p.leading === 'menu';
  const hasAction = p.action === 'search' || p.action === 'user' || p.action === 'more';
  // Both sides reserve the same width so the title stays centred.
  const side = hasLead || hasAction ? PAD + size + 8 : PAD;
  const showIcons = w >= side * 2 + 24;
  return (
    <>
      <SketchRect w={w} h={h} style={style} seed={seed} fill="surface" />
      {showIcons && hasLead && (
        <IconGlyph glyph={p.leading === 'back' ? 'chevron-left' : 'menu'} x={PAD} y={iy} size={size} style={style} seed={seed + 3} />
      )}
      {showIcons && hasAction && (
        <IconGlyph glyph={p.action as 'search' | 'user' | 'more'} x={w - PAD - size} y={iy} size={size} style={style} seed={seed + 5} />
      )}
      <TextRow x={showIcons ? side : PAD} w={w - (showIcons ? side : PAD) * 2} h={h} align="center" weight={700}>{p.title}</TextRow>
    </>
  );
}

const LINK_W = 84;
const SEARCH_W = 160;

interface WebLayout {
  pad: number; logo: number; ctrlH: number; cy: number; brandW: number; linksX: number;
  links: string[]; avatar?: number; cta?: { x: number; w: number }; search?: { x: number; w: number };
}

/** Where everything in the web header sits; shared by render and itemRects. */
function webLayout(p: HeaderProps, w: number, h: number): WebLayout {
  const pad = 16;
  const logo = Math.min(24, h - 16);
  const ctrlH = Math.min(32, h - 12);
  const cy = (h - ctrlH) / 2;
  const out: Omit<WebLayout, 'brandW' | 'linksX' | 'links'> = { pad, logo, ctrlH, cy };
  // Right side: CTA button / avatar, then search to its left.
  let right = w - pad;
  if (p.right === 'avatar' && w >= 160) {
    right -= ctrlH;
    out.avatar = right;
    right -= 12;
  } else if (p.right === 'button' && p.cta && w >= 220) {
    const bw = Math.min(112, Math.max(72, p.cta.length * 8 + 24));
    right -= bw;
    out.cta = { x: right, w: bw };
    right -= 12;
  }
  const brandW = Math.min(160, Math.max(48, String(p.title ?? '').length * 10 + logo + 20));
  const linksX = pad + brandW + 24;
  const sw = Math.min(SEARCH_W, right - linksX - LINK_W);
  if (toBool(p.search) && sw >= 96) {
    right -= sw;
    out.search = { x: right, w: sw };
    right -= 16;
  }
  const links = splitList(p.links).slice(0, Math.max(0, Math.floor((right - linksX) / LINK_W)));
  return { ...out, brandW, linksX, links };
}

function renderWeb(p: HeaderProps, w: number, h: number, style: 'sketchy' | 'clean', seed: number) {
  const { pad, logo, ctrlH, cy, brandW, linksX, links, avatar, cta, search } = webLayout(p, w, h);
  const brandFits = w >= pad * 2 + logo + 24;
  return (
    <>
      <SketchRect w={w} h={h} style={style} seed={seed} fill="surface" />
      <At x={pad} y={(h - logo) / 2} w={logo} h={logo}>
        <SketchRect w={logo} h={logo} radius={6} style={style} seed={seed + 3} fill="faint" stroke="muted" />
      </At>
      {brandFits && <TextRow x={pad + logo + 8} w={Math.min(brandW - logo - 8, w - pad * 2 - logo - 8)} h={h} weight={700}>{p.title}</TextRow>}
      {links.map((l, i) => (
        <TextRow key={i} x={linksX + i * LINK_W} w={LINK_W - 12} h={h} size="sm" tone={i === 0 ? 'ink' : 'muted'} weight={i === 0 ? 600 : 400}>{l}</TextRow>
      ))}
      {avatar !== undefined && (
        <At x={avatar} y={cy} w={ctrlH} h={ctrlH}>
          <SketchEllipse w={ctrlH} h={ctrlH} style={style} seed={seed + 7} stroke="muted" fill="faint" />
        </At>
      )}
      {cta && (
        <At x={cta.x} y={cy} w={cta.w} h={ctrlH}>
          <SketchRect w={cta.w} h={ctrlH} radius={6} style={style} seed={seed + 7} fill="faint" />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 8px' }}>
            <KitText size="sm" align="center" weight={700}>{p.cta}</KitText>
          </div>
        </At>
      )}
      {search && (
        <At x={search.x} y={cy} w={search.w} h={ctrlH}>
          <SketchRect w={search.w} h={ctrlH} radius={ctrlH / 2} style={style} seed={seed + 9} stroke="muted" />
          <IconAt name="search" x={10} y={(ctrlH - 14) / 2} size={14} tone="muted" />
          <TextRow x={30} w={search.w - 40} h={ctrlH} size="sm" tone="muted">Search</TextRow>
        </At>
      )}
    </>
  );
}

function headerItems(p: HeaderProps, w: number, h: number): KitItemRect[] {
  if (p.variant !== 'web') {
    const size = Math.min(ICON, h - 12);
    const iy = (h - size) / 2;
    const out: KitItemRect[] = [];
    const t = 8;
    if (p.leading === 'back' || p.leading === 'menu') out.push({ label: p.leading === 'back' ? 'Back' : 'Menu', x: PAD - t, y: iy - t, w: size + 2 * t, h: size + 2 * t });
    if (p.action === 'search' || p.action === 'user' || p.action === 'more') {
      out.push({ label: p.action[0].toUpperCase() + p.action.slice(1), x: w - PAD - size - t, y: iy - t, w: size + 2 * t, h: size + 2 * t });
    }
    return out;
  }
  const L = webLayout(p, w, h);
  const out: KitItemRect[] = [
    { label: String(p.title ?? '') || 'Logo', x: L.pad - 4, y: L.cy, w: Math.min(L.brandW, w - L.pad * 2) + 8, h: L.ctrlH },
    ...L.links.map((label, i) => ({ label, x: L.linksX + i * LINK_W - 6, y: L.cy, w: LINK_W, h: L.ctrlH })),
  ];
  if (L.search) out.push({ label: 'Search', x: L.search.x, y: L.cy, w: L.search.w, h: L.ctrlH });
  if (L.cta) out.push({ label: p.cta, x: L.cta.x, y: L.cy, w: L.cta.w, h: L.ctrlH });
  if (L.avatar !== undefined) out.push({ label: 'Avatar', x: L.avatar - 4, y: L.cy - 4, w: L.ctrlH + 8, h: L.ctrlH + 8 });
  return out;
}

export const header: KitItemDef<HeaderProps> = {
  type: 'header',
  label: 'Header',
  category: 'wireframe',
  group: 'navigation',
  keywords: ['header', 'app bar', 'top bar', 'title', 'navbar', 'toolbar', 'top nav', 'web header', 'navigation', 'masthead'],
  defaultSize: { w: 375, h: 56 },
  minSize: { w: 120, h: 40 },
  resize: 'horizontal',
  defaultProps: {
    title: 'Page title', leading: 'back', action: 'none',
    variant: 'app', links: 'Product, Pricing, Docs, Blog', search: true, right: 'button', cta: 'Sign up',
  },
  textProp: 'title',
  editableProps: [
    { key: 'title', label: 'Title', kind: 'text', bar: 'inline' },
    { key: 'variant', label: 'Type', kind: 'select', options: ['app', 'web'], bar: 'inline' },
    { key: 'leading', label: 'Left button (app)', kind: 'select', options: ['back', 'menu', 'none'], bar: 'more' },
    { key: 'action', label: 'Right button (app)', kind: 'select', options: ['none', 'search', 'user', 'more'], bar: 'more' },
    { key: 'links', label: 'Links (web)', kind: 'items', bar: 'more' },
    { key: 'search', label: 'Search (web)', kind: 'boolean', bar: 'more' },
    { key: 'right', label: 'Right side (web)', kind: 'select', options: ['button', 'avatar', 'none'], bar: 'more' },
    { key: 'cta', label: 'Button label (web)', kind: 'text', bar: 'more' },
  ],
  linkable: true,
  itemRects: (p, { w, h }) => headerItems(p, w, h),
  render: (p, { w, h, style, seed }) => (p.variant === 'web' ? renderWeb(p, w, h, style, seed) : renderApp(p, w, h, style, seed)),
  describe: (p) => {
    if (p.variant === 'web') {
      const links = splitList(p.links);
      const extras = [toBool(p.search) && 'search', p.right === 'avatar' && 'avatar', p.right === 'button' && p.cta && `'${p.cta}' button`].filter(Boolean);
      return `Web header '${p.title}'${links.length ? ` with links ${links.join(', ')}` : ''}${extras.length ? `; ${extras.join(', ')}` : ''}`;
    }
    const extras = [p.leading && p.leading !== 'none' && `${p.leading} button`, p.action && p.action !== 'none' && `${p.action} button`].filter(Boolean);
    return `Header '${p.title}'${extras.length ? ` with ${extras.join(' and ')}` : ''}`;
  },
};
