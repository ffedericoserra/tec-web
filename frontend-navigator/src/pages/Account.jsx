import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import {
  changeLanguage,
  localeForLanguage,
  normalizeLanguage,
} from '../i18n.js';
import '../styles/account.css';

const DEFAULT_AVATAR = '/uploads/profiles/default-avatar.jpeg';

function formatAmount(value, language) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat(localeForLanguage(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function museumName(visit, t) {
  return typeof visit?.museumId === 'object'
    ? visit.museumId?.name || t('common.museum')
    : t('common.museum');
}

function visitPath(visit) {
  const museum =
    typeof visit?.museumId === 'object'
      ? visit.museumId?.slug || visit.museumId?._id
      : visit?.museumId;
  const visitRef = visit?.slug || visit?._id;

  if (!museum || !visitRef) return null;
  return `/${encodeURIComponent(museum)}/${encodeURIComponent(visitRef)}`;
}

function VisitList({ visits, emptyMessage, onStart, t }) {
  if (!visits.length) {
    return <p className="account-empty">{emptyMessage}</p>;
  }

  return (
    <div className="account-list">
      {visits.map((visit) => {
        const path = visitPath(visit);
        const metadata = [
          museumName(visit, t),
          t(`visitMeta.type.${visit.type || 'standard'}`, {
            defaultValue: visit.type || 'standard',
          }),
          t(`visitMeta.length.${visit.length || 'normal'}`, {
            defaultValue: visit.length || 'normal',
          }),
          t(
            `visitMeta.visibility.${
              visit.isPublic === false ? 'private' : 'public'
            }`
          ),
        ];

        return (
          <article className="account-list-row" key={visit._id || visit.slug}>
            <div className="account-list-info">
              <span>{metadata.join(' / ')}</span>
              <h3>{visit.title || t('account.untitledVisit')}</h3>
            </div>
            <button
              type="button"
              className="account-row-action"
              disabled={!path}
              onClick={() => path && onStart(path)}
            >
              {t('account.start')}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export default function Account() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(getCachedUser());
  const [visits, setVisits] = useState([]);
  const [activeTab, setActiveTab] = useState('visits');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(10);
  const [recharging, setRecharging] = useState(false);
  const [rechargeError, setRechargeError] = useState(null);
  const [walletNoticeAmount, setWalletNoticeAmount] = useState(null);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageError, setLanguageError] = useState(null);

  const selectedLanguage = normalizeLanguage(i18n.resolvedLanguage) || 'it';

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;
    Promise.all([api('/auth/me'), api('/visits/my')])
      .then(([profileResponse, visitsResponse]) => {
        if (cancelled) return;
        const loadedUser = profileResponse.user;
        setUser(loadedUser);
        setCachedUser(loadedUser);
        setVisits(visitsResponse.visits || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          logout();
          return;
        }
        setError('account.loadError');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!rechargeOpen) return undefined;

    function closeOnEscape(event) {
      if (event.key === 'Escape' && !recharging) setRechargeOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [rechargeOpen, recharging]);

  async function rechargeWallet(event) {
    event.preventDefault();
    const amount = Number(rechargeAmount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      setRechargeError('account.rechargeInvalid');
      return;
    }

    setRecharging(true);
    setRechargeError(null);

    try {
      const response = await api('/auth/wallet', {
        method: 'PATCH',
        body: { amount },
      });
      const updatedUser = {
        ...user,
        walletBalance: response.walletBalance,
      };
      setUser(updatedUser);
      setCachedUser(updatedUser);
      setWalletNoticeAmount(amount);
      setRechargeOpen(false);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setRechargeError('account.rechargeError');
    } finally {
      setRecharging(false);
    }
  }

  async function updateLanguage(nextLanguage) {
    if (languageSaving) return;
    if (nextLanguage === selectedLanguage) {
      setLanguageError(null);
      return;
    }

    setLanguageSaving(true);
    setLanguageError(null);
    try {
      const response = await api('/auth/language', {
        method: 'PATCH',
        body: { language: nextLanguage },
      });
      const updatedUser = {
        ...user,
        language: response.user?.language || response.language || nextLanguage,
      };
      setUser(updatedUser);
      setCachedUser(updatedUser);
      await changeLanguage(updatedUser.language);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setLanguageError('account.languageError');
    } finally {
      setLanguageSaving(false);
    }
  }

  const savedVisits = user?.savedVisits?.filter(Boolean) || [];
  const avatarUrl = user?.avatarUrl || DEFAULT_AVATAR;

  return (
    <div className="page-account">
      <PageHeader
        subtitle={t('account.subtitle')}
        right={<ProfileMenu user={user} />}
      />

      <main className="account-main">
        <section className="account-heading">
          <span className="kicker">{t('account.kicker')}</span>
          <h1>{t('account.title')}</h1>
          <p>{t('account.intro')}</p>
        </section>

        {loading && <p className="account-status">{t('common.loading')}</p>}
        {error && !loading && <p className="account-status error">{t(error)}</p>}

        {!loading && !error && (
          <section className="account-dashboard">
            <aside className="account-summary" aria-label={t('account.summaryAria')}>
              <img
                className="account-avatar"
                src={avatarUrl}
                alt={t('header.profileAlt', {
                  username: user?.username || t('common.user').toLowerCase(),
                })}
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith(DEFAULT_AVATAR)) {
                    event.currentTarget.src = DEFAULT_AVATAR;
                  }
                }}
              />
              <h2>{user?.username || t('common.user')}</h2>
              <p className="account-email">
                {user?.email || t('account.emailUnavailable')}
              </p>

              <div className="account-wallet">
                <span>{t('account.balance')}</span>
                <strong>{formatAmount(user?.walletBalance, selectedLanguage)} Aα</strong>
                {walletNoticeAmount !== null && (
                  <p>
                    {t('account.rechargeDone', {
                      amount: formatAmount(walletNoticeAmount, selectedLanguage),
                    })}
                  </p>
                )}
                <button
                  type="button"
                  className="account-secondary-action"
                  onClick={() => {
                    setRechargeError(null);
                    setRechargeOpen(true);
                  }}
                >
                  {t('account.recharge')}
                </button>
              </div>

              <button
                type="button"
                className="account-logout"
                onClick={logout}
              >
                {t('common.logout')}
              </button>
            </aside>

            <section className="account-content">
              <div className="account-tabs" role="tablist" aria-label={t('account.tabsAria')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'visits'}
                  className={activeTab === 'visits' ? 'is-active' : ''}
                  onClick={() => setActiveTab('visits')}
                >
                  {t('account.tabs.visits')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'saved'}
                  className={activeTab === 'saved' ? 'is-active' : ''}
                  onClick={() => setActiveTab('saved')}
                >
                  {t('account.tabs.saved')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'settings'}
                  className={activeTab === 'settings' ? 'is-active' : ''}
                  onClick={() => setActiveTab('settings')}
                >
                  {t('account.tabs.settings')}
                </button>
              </div>

              <div className="account-panel" role="tabpanel">
                {activeTab === 'visits' && (
                  <>
                    <h2>{t('account.createdVisits')}</h2>
                    <VisitList
                      visits={visits}
                      emptyMessage={t('account.noCreatedVisits')}
                      onStart={navigate}
                      t={t}
                    />
                  </>
                )}
                {activeTab === 'saved' && (
                  <>
                    <h2>{t('account.savedVisits')}</h2>
                    <VisitList
                      visits={savedVisits}
                      emptyMessage={t('account.noSavedVisits')}
                      onStart={navigate}
                      t={t}
                    />
                  </>
                )}
                {activeTab === 'settings' && (
                  <>
                    <h2>{t('account.details')}</h2>
                    <dl className="account-details">
                      <div>
                        <dt>{t('account.username')}</dt>
                        <dd>{user?.username || '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('account.email')}</dt>
                        <dd>{user?.email || '—'}</dd>
                      </div>
                    </dl>
                    <section className="account-language" aria-labelledby="account-language-title">
                      <div>
                        <h3 id="account-language-title">{t('account.language')}</h3>
                        <p>{t('account.languageHint')}</p>
                      </div>
                      <div
                        className="account-language-options"
                        role="group"
                        aria-label={t('account.languageOptionsAria')}
                      >
                        <button
                          type="button"
                          className={selectedLanguage === 'it' ? 'is-active' : ''}
                          aria-pressed={selectedLanguage === 'it'}
                          disabled={languageSaving}
                          onClick={() => updateLanguage('it')}
                        >
                          {t('account.italian')}
                        </button>
                        <button
                          type="button"
                          className={selectedLanguage === 'en' ? 'is-active' : ''}
                          aria-pressed={selectedLanguage === 'en'}
                          disabled={languageSaving}
                          onClick={() => updateLanguage('en')}
                        >
                          {t('account.english')}
                        </button>
                      </div>
                      {languageSaving && (
                        <p className="account-language-status">{t('account.savingLanguage')}</p>
                      )}
                      {languageError && (
                        <p className="account-language-status error" role="alert">
                          {t(languageError)}
                        </p>
                      )}
                    </section>
                  </>
                )}
              </div>
            </section>
          </section>
        )}
      </main>

      {rechargeOpen && (
        <div
          className="account-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !recharging) {
              setRechargeOpen(false);
            }
          }}
        >
          <div
            className="account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recharge-title"
          >
            <h2 id="recharge-title">{t('account.rechargeTitle')}</h2>
            <p>
              {t('account.currentBalance', {
                amount: formatAmount(user?.walletBalance, selectedLanguage),
              })}
            </p>
            <div className="account-quick-amounts">
              {[10, 25, 50].map((amount) => (
                <button
                  type="button"
                  key={amount}
                  className={Number(rechargeAmount) === amount ? 'is-active' : ''}
                  onClick={() => setRechargeAmount(amount)}
                >
                  +{amount} Aα
                </button>
              ))}
            </div>
            <form onSubmit={rechargeWallet}>
              <label htmlFor="recharge-amount">{t('account.amount')}</label>
              <input
                id="recharge-amount"
                type="number"
                min="1"
                max="10000"
                step="1"
                value={rechargeAmount}
                onChange={(event) => setRechargeAmount(event.target.value)}
                autoFocus
              />
              {rechargeError && (
                <p className="account-modal-error" role="alert">{t(rechargeError)}</p>
              )}
              <div className="account-modal-actions">
                <button
                  type="button"
                  onClick={() => setRechargeOpen(false)}
                  disabled={recharging}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={recharging}>
                  {recharging ? t('account.recharging') : t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
