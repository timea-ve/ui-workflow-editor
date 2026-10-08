import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>FlowSketch</h1>
      <p>Phase 2 preview</p>
      <ul>
        <li><Link to="/gallery">Component gallery (both style options)</Link></li>
        <li><Link to="/sandbox">Flow sandbox</Link></li>
        <li><Link to="/chrome">App chrome (toolbar, panels, menus)</Link></li>
      </ul>
    </main>
  );
}
