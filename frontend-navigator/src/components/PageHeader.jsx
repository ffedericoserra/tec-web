import { Link } from 'react-router-dom';
import '../styles/header.css';

// `brandTo` is opt-in: during a visit the only way out is End Visit, so the
// runner deliberately leaves the brand inert.
export default function PageHeader({ subtitle, right, brandTo }) {
  return (
    <header className="page-header">
      <div className="page-header-brand">
        {brandTo ? (
          <Link className="brand-link" to={brandTo}>
            ArtAround
          </Link>
        ) : (
          <span>ArtAround</span>
        )}
        {subtitle && (
          <>
            <span className="brand-sep">|</span>
            <span className="brand-sub">{subtitle}</span>
          </>
        )}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}
