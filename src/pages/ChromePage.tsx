import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
  ChevronDown, Circle, Diamond, Heading, Image, List, Menu, MoveUpRight, PanelTop, PanelsTopLeft, RectangleHorizontal,
  Shapes, Smartphone, Square, SquareCheck, SquareDashed, SquareStack, StickyNote, Table, TextCursorInput, ToggleLeft, Type,
  type LucideIcon,
} from 'lucide-react';
import {
  Announcer, ChromeProvider, CoachMark, ContextMenu, InsertPalette, Inspector, InspectorSection, Kbd, MOD_KEY, OfflineBanner,
  OptionChip, Toasts, Toolbar, TopBar, isTypingTarget, toolForKey,
  type InsertItem, type MenuEntry, type SaveStatus, type ToastMessage, type ToolId,
} from '../chrome';
import { Box, KitText, LinkMarker, SketchArrow, SketchLines, SketchRect } from '../design/primitives';
import type { VisualStyle } from '../kit/types';
import '../chrome/preview.css';

// Owner: Design System agent. Gate 2 preview of the app chrome, laid out like the real
// editor, with a switch between the two candidate visual styles.

const STYLES: { id: VisualStyle; label: string }[] = [
  { id: 'sketchy', label: 'Option 1 · Sketchy' },
  { id: 'clean', label: 'Option 2 · Clean lo-fi' },
];

const INSERT_ITEMS: (InsertItem & { icon: LucideIcon })[] = [
  { id: 'screen-mobile', label: 'Screen – mobile', group: 'Screens', keywords: ['frame', 'phone', 'device'], hint: 'F 1', icon: Smartphone },
  { id: 'screen-desktop', label: 'Screen – desktop', group: 'Screens', keywords: ['frame', 'browser', 'device'], hint: 'F 3', icon: PanelsTopLeft },
  { id: 'header', label: 'Header', group: 'Wireframe', keywords: ['top bar', 'app bar'], icon: PanelTop },
  { id: 'nav', label: 'Navigation', group: 'Wireframe', keywords: ['menu', 'nav bar'], icon: Menu },
  { id: 'button', label: 'Button', group: 'Wireframe', keywords: ['cta', 'action', 'submit'], icon: RectangleHorizontal },
  { id: 'input', label: 'Text input', group: 'Wireframe', keywords: ['field', 'form', 'email'], icon: TextCursorInput },
  { id: 'checkbox', label: 'Checkbox', group: 'Wireframe', keywords: ['tick', 'form'], icon: SquareCheck },
  { id: 'toggle', label: 'Toggle', group: 'Wireframe', keywords: ['switch'], icon: ToggleLeft },
  { id: 'dropdown', label: 'Dropdown', group: 'Wireframe', keywords: ['select', 'picker'], icon: ChevronDown },
  { id: 'card', label: 'Card', group: 'Wireframe', keywords: ['tile', 'panel'], icon: SquareDashed },
  { id: 'list', label: 'List', group: 'Wireframe', keywords: ['rows', 'items'], icon: List },
  { id: 'table', label: 'Table', group: 'Wireframe', keywords: ['grid', 'data'], icon: Table },
  { id: 'image', label: 'Image placeholder', group: 'Wireframe', keywords: ['picture', 'photo', 'media'], icon: Image },
  { id: 'heading', label: 'Heading', group: 'Wireframe', keywords: ['title', 'h1'], icon: Heading },
  { id: 'modal', label: 'Modal', group: 'Wireframe', keywords: ['dialog', 'popup'], icon: SquareStack },
  { id: 'tabs', label: 'Tabs', group: 'Wireframe', keywords: ['segmented'], icon: PanelsTopLeft },
  { id: 'icon', label: 'Icon placeholder', group: 'Wireframe', keywords: ['glyph', 'symbol'], icon: Shapes },
  { id: 'rect', label: 'Rectangle', group: 'Diagram', keywords: ['box', 'step', 'process'], hint: 'R', icon: Square },
  { id: 'diamond', label: 'Decision', group: 'Diagram', keywords: ['diamond', 'if', 'branch'], hint: 'D', icon: Diamond },
  { id: 'ellipse', label: 'Start / end', group: 'Diagram', keywords: ['ellipse', 'circle', 'terminal'], hint: 'O', icon: Circle },
  { id: 'arrow', label: 'Arrow', group: 'Diagram', keywords: ['connector', 'line', 'link'], hint: 'A', icon: MoveUpRight },
  { id: 'text', label: 'Text', group: 'Diagram', keywords: ['label', 'note'], hint: 'T', icon: Type },
  { id: 'sticky', label: 'Sticky note', group: 'Diagram', keywords: ['comment', 'post-it'], hint: 'N', icon: StickyNote },
];
const ICON_BY_ID = Object.fromEntries(INSERT_ITEMS.map((i) => [i.id, i.icon]));

const MENU: MenuEntry[] = [
  { id: 'paste', label: 'Paste', shortcut: `${MOD_KEY}V` },
  { id: 'insert', label: 'Insert…', shortcut: '/' },
  { id: 'screen', label: 'Add screen', shortcut: 'F' },
  { id: 's1', type: 'separator' },
  { id: 'option', label: 'Duplicate as option', shortcut: `${MOD_KEY}⇧D` },
  { id: 'flow', label: 'Select flow', shortcut: '⇧F' },
  { id: 'link', label: 'Link to screen…', shortcut: 'L', disabled: true },
  { id: 's2', type: 'separator' },
  { id: 'fit', label: 'Zoom to fit', shortcut: '⇧1' },
];

const BUTTON_FIELDS = [
  { key: 'label', label: 'Label', kind: 'text' as const },
  { key: 'variant', label: 'Style', kind: 'select' as const, options: ['primary', 'secondary'] },
  { key: 'disabled', label: 'Show as disabled', kind: 'boolean' as const },
];

const menuLabel = (id: string) => {
  const m = MENU.find((e) => e.id === id);
  return m && m.type !== 'separator' ? m.label : id;
};

let toastSeq = 0;

export function ChromePage() {
  const [params, setParams] = useSearchParams();
  const style: VisualStyle = params.get('style') === 'sketchy' ? 'sketchy' : 'clean';
  const [board, setBoard] = useState<'empty' | 'flow'>('flow');
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [title, setTitle] = useState('Sign-up flow');
  const [tool, setTool] = useState<ToolId>('select');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [button, setButton] = useState<Record<string, unknown>>({ label: 'Continue', variant: 'primary', disabled: false });

  const toast = useCallback((message: string, actionLabel?: string) => {
    toastSeq += 1;
    setToasts((t) => [...t.slice(-2), { id: `t${toastSeq}`, message, actionLabel, onAction: actionLabel ? () => setAnnouncement('Undone') : undefined }]);
  }, []);

  const setStyle = (s: VisualStyle) => setParams((p) => { p.set('style', s); return p; }, { replace: true });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paletteOpen || e.defaultPrevented) return;
      if (e.shiftKey && e.key.toLowerCase() === 'c' && !isTypingTarget(e.target)) { toast('Compare opens here (next phase)'); return; }
      const hit = toolForKey(e, isTypingTarget(e.target) || e.shiftKey);
      if (!hit) return;
      if (hit === 'insert') { e.preventDefault(); setPaletteOpen(true); }
      else if (hit === 'play') toast('Play mode starts here (next phase)');
      else setTool(hit);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, toast]);

  const selection = useMemo(
    () => (board === 'flow' && tool === 'select' ? { kind: 'Button', title: String(button.label), fields: BUTTON_FIELDS, values: button } : null),
    [board, tool, button],
  );

  return (
    <ChromeProvider>
      <div className="fsp-page" data-kit-style={style}>
        <ReviewBar style={style} onStyle={setStyle} board={board} onBoard={setBoard} status={status} onStatus={setStatus} />
        {status === 'offline' ? <OfflineBanner /> : <span />}
        <TopBar
          title={title}
          onTitleChange={(t) => { setTitle(t); setAnnouncement(`Board renamed to ${t}`); }}
          saveStatus={status}
          onShare={() => toast('Read-only link copied')}
          onExport={(f) => toast(`Exporting ${f === 'board' ? 'board file' : f.toUpperCase()}…`)}
          onCompare={() => toast('Compare opens here (next phase)')}
          compareDisabled={board === 'empty'}
          onPlay={() => toast('Play mode starts here (next phase)')}
        />
        <div className="fsp-body">
          <ContextMenu items={MENU} onSelect={(id) => (id === 'insert' ? setPaletteOpen(true) : toast(`${menuLabel(id)} (preview)`))}>
            <section className="fsp-canvas" aria-label="Canvas. Right-click or Shift+F10 for actions." tabIndex={0}>
              <div className="fsp-toolbar">
                <Toolbar activeTool={tool} onToolChange={setTool} onAction={(a) => (a === 'insert' ? setPaletteOpen(true) : toast('Play mode starts here (next phase)'))} />
              </div>
              {board === 'empty' ? (
                <div className="fsp-empty"><CoachMark onTemplate={() => toast('Templates open here (next phase)')} /></div>
              ) : (
                <SampleBoard style={style} button={button} />
              )}
              <p className="fsp-hint" aria-hidden>Try <Kbd>R</Kbd><Kbd>/</Kbd> or right-click</p>
            </section>
          </ContextMenu>
          <Inspector selection={selection} onChange={(k, v) => setButton((b) => ({ ...b, [k]: v }))}>
            <InspectorSection title="Link">
              <p style={{ margin: 0, fontSize: 'var(--fs-ui-text-sm)' }}>Goes to <strong>Verify email</strong></p>
              <div style={{ display: 'flex', gap: 'var(--fs-space-2)' }}>
                <button type="button" className="fsc-btn fsc-btn--outline" onClick={() => toast('Link picker opens here (next phase)')}>Change <Kbd>L</Kbd></button>
                <button type="button" className="fsc-btn" onClick={() => toast('Link removed', 'Undo')}>Remove</button>
              </div>
            </InspectorSection>
            <InspectorSection title="Option">
              <div><OptionChip letter="A" active /></div>
            </InspectorSection>
          </Inspector>
        </div>
        <InsertPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          items={INSERT_ITEMS}
          renderIcon={(item) => { const I = ICON_BY_ID[item.id]; return I ? <I size={18} strokeWidth={1.75} /> : null; }}
          onSelect={(item) => { toast(`${item.label} added`, 'Undo'); setAnnouncement(`${item.label} added`); }}
        />
        <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
        <Announcer message={announcement} />
      </div>
    </ChromeProvider>
  );
}

function ReviewBar({ style, onStyle, board, onBoard, status, onStatus }: {
  style: VisualStyle; onStyle: (s: VisualStyle) => void;
  board: 'empty' | 'flow'; onBoard: (b: 'empty' | 'flow') => void;
  status: SaveStatus; onStatus: (s: SaveStatus) => void;
}) {
  return (
    <div className="fsp-review fsc-root" role="region" aria-label="Preview controls">
      <Link to="/">← Home</Link>
      <div className="fsp-review__group">
        <span className="fsp-review__label" id="lbl-style">Visual style</span>
        <ToggleGroup.Root className="fsp-seg" type="single" value={style} onValueChange={(v) => v && onStyle(v as VisualStyle)} aria-labelledby="lbl-style">
          {STYLES.map((s) => <ToggleGroup.Item key={s.id} value={s.id}>{s.label}</ToggleGroup.Item>)}
        </ToggleGroup.Root>
      </div>
      <div className="fsp-review__group">
        <span className="fsp-review__label" id="lbl-board">Board</span>
        <ToggleGroup.Root className="fsp-seg" type="single" value={board} onValueChange={(v) => v && onBoard(v as 'empty' | 'flow')} aria-labelledby="lbl-board">
          <ToggleGroup.Item value="flow">With a flow</ToggleGroup.Item>
          <ToggleGroup.Item value="empty">Empty</ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>
      <label className="fsp-review__group">
        <span className="fsp-review__label">Save status</span>
        <select className="fsc-select" value={status} onChange={(e) => onStatus(e.target.value as SaveStatus)}>
          <option value="saved">Saved</option>
          <option value="saving">Saving</option>
          <option value="offline">Offline</option>
          <option value="error">Save failed</option>
        </select>
      </label>
      <div className="fsp-review__group">
        <span className="fsp-review__label">Focus ring</span>
        <span className="fsc-btn fsc-btn--outline fsp-focus-demo" aria-hidden>Sample</span>
        <span className="fsp-review__label">(press Tab to see it anywhere)</span>
      </div>
    </div>
  );
}

/* ── Sample board: two option lanes drawn with the shared primitives ────────── */

const SW = 180;
const SH = 296;

function SampleBoard({ style, button }: { style: VisualStyle; button: Record<string, unknown> }) {
  const primary = button.variant === 'primary';
  const disabled = Boolean(button.disabled);
  return (
    <div className="fsp-board">
      <Lane y={0} letter="A" style={style} seed={11} />
      <Screen x={32} y={76} title="Sign up" style={style} seed={21}>
        <KitText size="lg" weight={700} style={{ position: 'absolute', left: 16, top: 18, width: 148 }}>Create account</KitText>
        <Field y={60} label="Email" placeholder="you@example.com" style={style} seed={22} />
        <Field y={122} label="Password" placeholder="••••••••" style={style} seed={23} />
        <Box x={16} y={190} w={14} h={14}><SketchRect w={14} h={14} radius={3} style={style} seed={24} /></Box>
        <Box x={38} y={188} w={120} h={18}><KitText size="sm">Remember me</KitText></Box>
        <Box x={16} y={232} w={148} h={36} style={{ opacity: disabled ? 0.5 : 1 }}>
          <div className="fsp-selected" style={{ position: 'absolute', inset: 0 }} />
          <SketchRect w={148} h={36} radius={6} style={style} seed={25} fill={primary ? 'faint' : 'none'} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <KitText align="center" weight={primary ? 700 : 400}>{String(button.label)}</KitText>
          </div>
          <LinkMarker />
          {([[-7, -7], [143, -7], [-7, 31], [143, 31]] as const).map(([l, t]) => (
            <span key={`${l}${t}`} className="fsp-handle" style={{ left: l - 1, top: t - 1 }} aria-hidden />
          ))}
        </Box>
      </Screen>
      <Screen x={352} y={76} title="Verify email" style={style} seed={31}>
        <KitText size="lg" weight={700} style={{ position: 'absolute', left: 16, top: 18, width: 148 }}>Check inbox</KitText>
        <Box x={16} y={60} w={148} h={84}>
          <SketchRect w={148} h={84} style={style} seed={32} stroke="muted" />
          <SketchLines w={148} h={84} lines={[[[0, 0], [148, 84]], [[148, 0], [0, 84]]]} style={style} seed={33} stroke="faint" />
        </Box>
        <TextLines y={160} style={style} seed={34} />
        <Btn y={232} label="I've verified" style={style} seed={35} linked />
      </Screen>
      <Screen x={672} y={76} title="Welcome" style={style} seed={41}>
        <KitText size="lg" weight={700} style={{ position: 'absolute', left: 16, top: 18, width: 148 }}>Welcome, Sam!</KitText>
        {[60, 128].map((y, i) => (
          <Box key={y} x={16} y={y} w={148} h={56}>
            <SketchRect w={148} h={56} radius={6} style={style} seed={42 + i} stroke="muted" />
            <Box x={10} y={10} w={36} h={36}><SketchRect w={36} h={36} radius={4} style={style} seed={50 + i} fill="faint" stroke="muted" /></Box>
            <Box x={54} y={14} w={86} h={30}><KitText size="sm">{i ? 'Invite team' : 'Set up profile'}</KitText><KitText size="sm" tone="muted">2 min</KitText></Box>
          </Box>
        ))}
        <Btn y={232} label="Get started" style={style} seed={46} />
      </Screen>
      <Arrows style={style} seed={60} paths={[
        [[196, 326], [274, 326], [274, 224], [350, 224]],
        [[516, 326], [594, 326], [594, 224], [670, 224]],
      ]} />

      <Lane y={430} letter="B" name="Social login" style={style} seed={12} />
      <Screen x={32} y={506} title="Sign up" style={style} seed={71}>
        <KitText size="lg" weight={700} style={{ position: 'absolute', left: 16, top: 18, width: 148 }}>Create account</KitText>
        <Btn y={60} label="Use Google" style={style} seed={72} />
        <Btn y={104} label="Use Apple" style={style} seed={73} />
        <Box x={16} y={156} w={148} h={18}>
          <SketchLines w={148} h={18} lines={[[[0, 9], [58, 9]], [[90, 9], [148, 9]]]} style={style} seed={74} stroke="faint" />
          <KitText size="sm" tone="muted" align="center">or</KitText>
        </Box>
        <Field y={176} label="" placeholder="you@example.com" style={style} seed={75} />
        <Btn y={232} label="Continue" style={style} seed={76} primary linked />
      </Screen>
      <Screen x={352} y={506} title="Welcome" style={style} seed={81}>
        <KitText size="lg" weight={700} style={{ position: 'absolute', left: 16, top: 18, width: 148 }}>Welcome, Sam!</KitText>
        <TextLines y={62} style={style} seed={82} />
        <Btn y={232} label="Get started" style={style} seed={83} />
      </Screen>
      <Arrows style={style} seed={90} paths={[[[196, 756], [274, 756], [274, 654], [350, 654]]]} />
    </div>
  );
}

function Lane({ y, letter, name, style, seed }: { y: number; letter: string; name?: string; style: VisualStyle; seed: number }) {
  return (
    <>
      <Box x={0} y={y} w={300} h={28}><OptionChip letter={letter} name={name} /></Box>
      <Box x={0} y={y + 36} w={900} h={364}>
        <SketchRect w={900} h={364} radius={12} style={style} seed={seed} stroke="faint" dashed />
      </Box>
    </>
  );
}

function Screen({ x, y, title, style, seed, children }: { x: number; y: number; title: string; style: VisualStyle; seed: number; children: ReactNode }) {
  return (
    <Box x={x} y={y} w={SW} h={SH}>
      <span className="fsp-screen-title">{title}</span>
      <SketchRect w={SW} h={SH} radius={14} style={style} seed={seed} fill="surface" />
      {children}
    </Box>
  );
}

function Field({ y, label, placeholder, style, seed }: { y: number; label: string; placeholder: string; style: VisualStyle; seed: number }) {
  return (
    <>
      {label && <Box x={16} y={y} w={148} h={18}><KitText size="sm" tone="muted">{label}</KitText></Box>}
      <Box x={16} y={y + 20} w={148} h={34}>
        <SketchRect w={148} h={34} radius={6} style={style} seed={seed} />
        <KitText size="sm" tone="muted" style={{ position: 'absolute', left: 10, top: 9, width: 128 }}>{placeholder}</KitText>
      </Box>
    </>
  );
}

function Btn({ y, label, style, seed, primary, linked }: { y: number; label: string; style: VisualStyle; seed: number; primary?: boolean; linked?: boolean }) {
  return (
    <Box x={16} y={y} w={148} h={36}>
      <SketchRect w={148} h={36} radius={6} style={style} seed={seed} fill={primary ? 'faint' : 'none'} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 8px' }}>
        <KitText align="center" weight={primary ? 700 : 400}>{label}</KitText>
      </div>
      {linked && <LinkMarker />}
    </Box>
  );
}

function TextLines({ y, style, seed }: { y: number; style: VisualStyle; seed: number }) {
  return (
    <Box x={16} y={y} w={148} h={56}>
      <SketchLines w={148} h={56} style={style} seed={seed} stroke="faint" strokeWidth={3}
        lines={[[[2, 6], [146, 6]], [[2, 22], [138, 22]], [[2, 38], [120, 38]]]} />
    </Box>
  );
}

function Arrows({ paths, style, seed }: { paths: [number, number][][]; style: VisualStyle; seed: number }) {
  return (
    <Box x={0} y={0} w={1010} h={860} style={{ pointerEvents: 'none' }}>
      {paths.map((p, i) => <SketchArrow key={i} w={1010} h={860} points={p} style={style} seed={seed + i} stroke="ink" />)}
    </Box>
  );
}
