import { Link } from 'react-router-dom';
import { wireframeKit, diagramKit, kitRegistry, seedFromId } from '../kit/registry';
import { KitItemView } from '../kit/KitItemView';
import type { VisualStyle } from '../kit/types';
import { DeviceFrame, deviceContentInset } from '../kit/wireframe/DeviceFrame';
import { DEVICE_SIZES, type Device, type ElementType } from '../model/types';

// Gate 2 review page: every kit item rendered in both candidate styles, side by side.
const STYLES: { id: VisualStyle; title: string }[] = [
  { id: 'sketchy', title: 'Option 1 — Sketchy' },
  { id: 'clean', title: 'Option 2 — Clean lo-fi' },
];

export function GalleryPage() {
  const sections = [
    { title: 'Wireframe kit', items: wireframeKit },
    { title: 'Diagram kit', items: diagramKit },
  ];
  return (
    <main style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <p><Link to="/">← Home</Link></p>
      <h1 style={{ margin: '0 0 4px' }}>Component gallery</h1>
      <p style={{ marginTop: 0, color: 'var(--fs-muted)' }}>Every building block, shown in both style options.</p>
      {sections.map((s) => (
        <section key={s.title} aria-labelledby={`h-${s.title}`}>
          <h2 id={`h-${s.title}`}>{s.title} <small style={{ color: 'var(--fs-muted)', fontWeight: 400 }}>({s.items.length})</small></h2>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 16, alignItems: 'center' }}>
            <span />
            {STYLES.map((st) => <strong key={st.id}>{st.title}</strong>)}
            {s.items.map((def) => (
              <Row key={def.type} label={def.label}>
                {STYLES.map((st) => (
                  <div key={st.id} data-kit-style={st.id} style={{ background: 'var(--fs-surface)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
                    <KitItemView def={def} style={st.id} seed={seedFromId(def.type)} />
                  </div>
                ))}
              </Row>
            ))}
          </div>
        </section>
      ))}
      <StatesSection />
      <DeviceFramesSection />
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span>{label}</span>
      {children}
    </>
  );
}

// Interactive-state pairs, so reviewers can check every state reads clearly in both styles.
const STATES: { type: ElementType; label: string; props: Record<string, unknown>; w?: number; h?: number }[] = [
  { type: 'checkbox', label: 'Checkbox — unchecked', props: { checked: false } },
  { type: 'checkbox', label: 'Checkbox — checked', props: { checked: true } },
  { type: 'toggle', label: 'Toggle — off', props: { on: false } },
  { type: 'toggle', label: 'Toggle — on', props: { on: true } },
  { type: 'dropdown', label: 'Dropdown — open', props: { open: true, value: 'Germany' }, h: 180 },
  { type: 'tabs', label: 'Tabs — 2nd active', props: { active: 1 } },
  { type: 'button', label: 'Button — secondary', props: { variant: 'secondary', label: 'Cancel' } },
  { type: 'list', label: 'List — resized short (rows hidden)', props: { count: 8 }, h: 120 },
  { type: 'card', label: 'Card — no image, small', props: { hasImage: false }, w: 200, h: 96 },
];

function StatesSection() {
  return (
    <section aria-labelledby="h-states">
      <h2 id="h-states">States &amp; resizing</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 16, alignItems: 'center' }}>
        <span />
        {STYLES.map((st) => <strong key={st.id}>{st.title}</strong>)}
        {STATES.map((s) => {
          const def = kitRegistry.get(s.type);
          if (!def) return null;
          return (
            <Row key={s.label} label={s.label}>
              {STYLES.map((st) => (
                <div key={st.id} data-kit-style={st.id} style={{ background: 'var(--fs-surface)', padding: 16, borderRadius: 8, overflow: 'auto' }}>
                  <KitItemView def={def} props={s.props} w={s.w} h={s.h} style={st.id} seed={seedFromId(s.label)} />
                </div>
              ))}
            </Row>
          );
        })}
      </div>
    </section>
  );
}

const FRAME_SCALE = 0.35;
const TITLE_SPACE = 24;
const DEVICES: Device[] = ['mobile', 'tablet', 'desktop'];

function DeviceFramesSection() {
  return (
    <section aria-labelledby="h-devices">
      <h2 id="h-devices">Device frames</h2>
      <p style={{ marginTop: 0, color: 'var(--fs-muted)' }}>A mini sign-up screen on each device, shown at {Math.round(FRAME_SCALE * 100)}%.</p>
      {STYLES.map((st) => (
        <div key={st.id} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16 }}>{st.title}</h3>
          <div data-kit-style={st.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', background: 'var(--fs-surface)', padding: 16, borderRadius: 8 }}>
            {DEVICES.map((d) => {
              const { w, h } = DEVICE_SIZES[d];
              return (
                <figure key={d} style={{ margin: 0, flex: 'none' }}>
                  <div style={{ width: w * FRAME_SCALE, height: (h + TITLE_SPACE) * FRAME_SCALE, overflow: 'hidden' }}>
                    <div style={{ width: w, height: h, transform: `scale(${FRAME_SCALE})`, transformOrigin: 'top left', marginTop: TITLE_SPACE * FRAME_SCALE }}>
                      <DeviceFrame device={d} w={w} h={h} name={`Sign up — ${d}`} style={st.id} seed={seedFromId(`${d}-${st.id}`)}>
                        <SignUpScreen device={d} style={st.id} />
                      </DeviceFrame>
                    </div>
                  </div>
                  <figcaption style={{ marginTop: 8, fontSize: 13, color: 'var(--fs-muted)', textTransform: 'capitalize' }}>{d} · {w}×{h}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function SignUpScreen({ device, style }: { device: Device; style: VisualStyle }) {
  const inset = deviceContentInset(device);
  const cw = DEVICE_SIZES[device].w - inset.left - inset.right;
  const colW = Math.min(cw - 48, 400);
  const x = (cw - colW) / 2;
  const items: { type: ElementType; x: number; y: number; w: number; h: number; props?: Record<string, unknown> }[] = [
    { type: 'header', x: 0, y: 0, w: cw, h: 56, props: { title: 'Sign up', leading: 'back' } },
    { type: 'heading', x, y: 88, w: colW, h: 36, props: { text: 'Create account' } },
    { type: 'text', x, y: 128, w: colW, h: 40, props: { text: 'Start sketching flows in minutes.', tone: 'muted' } },
    { type: 'input', x, y: 176, w: colW, h: 64, props: { label: 'Name', placeholder: 'Ada Lovelace' } },
    { type: 'input', x, y: 248, w: colW, h: 64 },
    { type: 'input', x, y: 320, w: colW, h: 64, props: { label: 'Password', placeholder: '••••••••' } },
    { type: 'checkbox', x, y: 400, w: colW, h: 24, props: { label: 'I agree to the Terms', checked: true } },
    { type: 'button', x, y: 440, w: colW, h: 44, props: { label: 'Create account' } },
    { type: 'text', x, y: 500, w: colW, h: 24, props: { text: 'Already have an account? Log in', align: 'center', size: 'sm' } },
  ];
  return (
    <>
      {items.map((it, i) => {
        const def = kitRegistry.get(it.type);
        if (!def) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: it.x, top: it.y }}>
            <KitItemView def={def} props={it.props} w={it.w} h={it.h} style={style} seed={seedFromId(`${device}-${i}`)} />
          </div>
        );
      })}
    </>
  );
}
