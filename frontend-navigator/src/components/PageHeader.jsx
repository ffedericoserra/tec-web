import { useNavigate } from "react-router-dom"
import { isAuthenticated } from "../auth.js"
import "../styles/header.css"

export default function PageHeader({ subtitle, right }) {
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
                <span>ArtAround</span>
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
