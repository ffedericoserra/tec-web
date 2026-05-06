import '../styles/header.css';

export default function PageHeader({ subtitle, right }) {
  return (
    <header className="page-header">
      <div className="page-header-brand">
        <span>ArtAround</span>
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
