import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { EditorPage } from './pages/EditorPage';
import { SharePage } from './pages/SharePage';
import { HomePage } from './pages/HomePage';
import { GalleryPage } from './pages/GalleryPage';
import { FlowSandboxPage } from './pages/FlowSandboxPage';
import { ChromePage } from './pages/ChromePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/b/:boardId" element={<EditorPage />} />
        <Route path="/s/:shareId" element={<SharePage />} />
        {/* Dev previews */}
        <Route path="/dev" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/sandbox" element={<FlowSandboxPage />} />
        <Route path="/chrome" element={<ChromePage />} />
      </Routes>
    </BrowserRouter>
  );
}
