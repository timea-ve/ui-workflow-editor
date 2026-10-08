import { Link } from 'react-router-dom';
import { wireframeKit, diagramKit, seedFromId } from '../kit/registry';
import { KitItemView } from '../kit/KitItemView';
import type { VisualStyle } from '../kit/types';

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
