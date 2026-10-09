// Any unknown URL. Plain and calm; one way back.
import { Link } from 'react-router-dom';
import '../chrome/chrome.css';
import '../editor/editor.css';

export function NotFoundPage() {
  return (
    <main className="fse-state fsc-root">
      <div className="fse-state__box">
        <h1 className="fse-state__title">Page not found</h1>
        <p className="fse-state__text">This address doesn’t match a board or page. Check the link, or go back to your boards.</p>
        <Link to="/" className="fsc-btn fsc-btn--outline">Back to your boards</Link>
      </div>
    </main>
  );
}
