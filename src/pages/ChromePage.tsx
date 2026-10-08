import { Link } from 'react-router-dom';

// Owner: Design System agent. Gate 2 preview of app chrome (toolbar, panels, menus) in both style options.
export function ChromePage() {
  return (
    <main style={{ padding: 32 }}>
      <p><Link to="/">← Home</Link></p>
      <h1>App chrome</h1>
      <p>Coming in Phase 2.</p>
    </main>
  );
}
