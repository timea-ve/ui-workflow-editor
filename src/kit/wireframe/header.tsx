import type { ReactNode } from 'react';
import type { KitItemDef } from '../types';
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

function renderWeb(p: HeaderProps, w: number, h: number, style: 'sketchy' | 'clean', seed: number) {
  const pad = 16;
  const logo = Math.min(24, h - 16);
  const ctrlH = Math.min(32, h - 12);
  const cy = (h - ctrlH) / 2;
  // Right side: CTA button / avatar, then search to its left.
  let right = w - pad;
  const rightParts: ReactNode[] = [];
  if (p.right === 'avatar' && w >= 160) {
    right -= ctrlH;
    rightParts.push(
      <At key="av" x={right} y={cy} w={ctrlH} h={ctrlH}>
        <SketchEllipse w={ctrlH} h={ctrlH} style={style} seed={seed + 7} stroke="muted" fill="faint" />
      </At>,
    );
    right -= 12;
  } else if (p.right === 'button' && p.cta && w >= 220) {
    const bw = Math.min(112, Math.max(72, p.cta.length * 8 + 24));
    right -= bw;
    rightParts.push(
      <At key="cta" x={right} y={cy} w={bw} h={ctrlH}>
        <SketchRect w={bw} h={ctrlH} radius={6} style={style} seed={seed + 7} fill="faint" />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 8px' }}>
          <KitText size="sm" align="center" weight={700}>{p.cta}</KitText>
        </div>
      </At>,
    );
    right -= 12;
  }
  const brandW = Math.min(160, Math.max(48, String(p.title ?? '').length * 10 + logo + 20));
  const linksX = pad + brandW + 24;
  const sw = Math.min(SEARCH_W, right - linksX - LINK_W);
  if (toBool(p.search) && sw >= 96) {
    right -= sw;
    rightParts.push(
      <At key="search" x={right} y={cy} w={sw} h={ctrlH}>
        <SketchRect w={sw} h={ctrlH} radius={ctrlH / 2} style={style} seed={seed + 9} stroke="muted" />
        <IconAt name="search" x={10} y={(ctrlH - 14) / 2} size={14} tone="muted" />
        <TextRow x={30} w={sw - 40} h={ctrlH} size="sm" tone="muted">Search</TextRow>
      </At>,
    );
    right -= 16;
  }
  const allLinks = splitList(p.links);
  const links = allLinks.slice(0, Math.max(0, Math.floor((right - linksX) / LINK_W)));
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
      {rightParts}
    </>
  );
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
