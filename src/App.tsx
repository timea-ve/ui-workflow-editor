import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { GalleryPage } from './pages/GalleryPage';
import { FlowSandboxPage } from './pages/FlowSandboxPage';
import { ChromePage } from './pages/ChromePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/sandbox" element={<FlowSandboxPage />} />
        <Route path="/chrome" element={<ChromePage />} />
      </Routes>
    </BrowserRouter>
  );
}
