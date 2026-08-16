import { Link, useNavigate } from "react-router-dom"
import { isAuthenticated } from "../auth.js"
import "../styles/header.css"

// `brandTo` is opt-in: during a visit the only way out is End Visit, so the
// runner deliberately leaves the brand inert.
export default function PageHeader({ subtitle, right, brandTo }) {
    const navigate = useNavigate()

    if (!isAuthenticated()) return null

    function goBack() {
        if (window.history.length > 1) {
            navigate(-1)
            return
        }

        navigate("/")
    }

    return (
        <header className="page-header">
            <button
                type="button"
                className="page-header-back"
                onClick={goBack}
                aria-label="Torna indietro"
                title="Torna indietro"
            >
                <span aria-hidden="true">←</span>
            </button>
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
            <div className="page-header-actions">
                <a className="page-header-marketplace" href="/marketplace">
                    GO TO MARKETPLACE
                </a>
                {right && <div className="page-header-right">{right}</div>}
            </div>
        </header>
    )
}
