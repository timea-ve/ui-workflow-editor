// Wave B features register here to mount into the editor layout without editing it.
// Each entry renders into a named slot (see docs/phase-3/editor-api.md):
//   leftPanel      – left side, under the toolbar (e.g. flows / layers panel)
//   rightPanel     – right side (e.g. Inspector)
//   topBarActions  – right side of the top bar (e.g. Play, Compare, Share, Export)
//   overlay        – full-editor overlays (e.g. Insert palette, Play mode, Compare view, dialogs)
//   canvas         – inside the React Flow canvas (ViewportPortal / Panel children, e.g. inline text editor)
import type { EditorExtension } from './EditorContext';
import { ExportAction, ShareAction } from './integrations/ShareExport';

export const EDITOR_EXTENSIONS: EditorExtension[] = [
  { id: 'share', slot: 'topBarActions', render: () => <ShareAction /> },
  { id: 'export', slot: 'topBarActions', render: () => <ExportAction /> },
];
