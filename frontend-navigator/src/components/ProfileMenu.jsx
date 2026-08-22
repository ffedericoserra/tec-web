import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { logout } from "../auth.js"
import { localeForLanguage } from "../i18n.js"

export default function ProfileMenu({ user }) {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return
        function onDocClick(e) {
            if (!ref.current?.contains(e.target)) setOpen(false)
        }
        function onKey(e) {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDocClick)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDocClick)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    const defaultAvatarUrl = "/uploads/profiles/default-avatar.jpeg"
    const avatarUrl = user?.avatarUrl || defaultAvatarUrl

    return (
        <div className="profile" ref={ref}>
            <button
                type="button"
                className="profile-btn"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t("header.openProfile")}
            >
                <img
                    className="profile-avatar"
                    src={avatarUrl}
                    alt={t("header.profileAlt", {
                        username: user?.username || t("common.user").toLowerCase(),
                    })}
                    onError={(event) => {
                        if (event.currentTarget.src.endsWith(defaultAvatarUrl))
                            return
                        event.currentTarget.src = defaultAvatarUrl
                    }}
                />
            </button>
            {open && (
                <div className="profile-menu" role="menu">
                    <p className="profile-username">
                        {user?.username || t("common.user")}
                    </p>
                    {typeof user?.walletBalance === "number" && (
                        <p className="profile-wallet">
                            {t("header.balance", {
                                amount: new Intl.NumberFormat(
                                    localeForLanguage(i18n.resolvedLanguage),
                                    { maximumFractionDigits: 2 }
                                ).format(user.walletBalance),
                            })}
                        </p>
                    )}
                    <button
                        type="button"
                        className="profile-menu-action"
                        role="menuitem"
                        onClick={() => {
                            setOpen(false)
                            navigate("/account")
                        }}
                    >
                        {t("header.viewAccount")}
                    </button>
                    <button
                        type="button"
                        className="profile-menu-action profile-logout"
                        role="menuitem"
                        onClick={logout}
                    >
                        {t("common.logout")}
                    </button>
                </div>
            )}
        </div>
    )
}
