import { Link } from 'react-router-dom';

// Owner: Diagram & Flow agent. Gate 2 sandbox: a small board proving
// screens + components + connectors + links + an Option B variant render on the canvas.
export function FlowSandboxPage() {
  return (
    <main style={{ padding: 32 }}>
      <p><Link to="/">← Home</Link></p>
      <h1>Flow sandbox</h1>
      <p>Coming in Phase 2.</p>
    </main>
  );
}
