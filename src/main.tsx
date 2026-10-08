import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import './design/tokens.css';
import { GalleryPage } from './pages/GalleryPage';
import { FlowSandboxPage } from './pages/FlowSandboxPage';
import { ChromePage } from './pages/ChromePage';

function Home() {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/sandbox" element={<FlowSandboxPage />} />
        <Route path="/chrome" element={<ChromePage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
