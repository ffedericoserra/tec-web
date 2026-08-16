import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import '../styles/account.css';

const DEFAULT_AVATAR = '/uploads/profiles/default-avatar.jpeg';

function formatAmount(value) {
  const amount = Number(value) || 0;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function museumName(visit) {
  return typeof visit?.museumId === 'object'
    ? visit.museumId?.name || 'Museo'
    : 'Museo';
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

function VisitList({ visits, emptyMessage, onStart }) {
  if (!visits.length) {
    return <p className="account-empty">{emptyMessage}</p>;
  }

  return (
    <div className="account-list">
      {visits.map((visit) => {
        const path = visitPath(visit);
        const metadata = [
          museumName(visit),
          visit.type || 'standard',
          visit.length || 'normal',
          visit.isPublic === false ? 'privata' : 'pubblica',
        ];

        return (
          <article className="account-list-row" key={visit._id || visit.slug}>
            <div className="account-list-info">
              <span>{metadata.join(' / ')}</span>
              <h3>{visit.title || 'Visita senza titolo'}</h3>
            </div>
            <button
              type="button"
              className="account-row-action"
              disabled={!path}
              onClick={() => path && onStart(path)}
            >
              Avvia
            </button>
          </article>
        );
      })}
    </div>
  );
}

export default function Account() {
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
  const [walletNotice, setWalletNotice] = useState(null);

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
        setError(err.message || 'Impossibile caricare il profilo');
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
      setRechargeError('Inserisci un importo compreso tra 1 e 10000.');
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
        ...(response.user || {}),
        walletBalance: response.walletBalance,
      };
      setUser(updatedUser);
      setCachedUser(updatedUser);
      setWalletNotice(`Ricarica completata: +${formatAmount(amount)} Aα.`);
      setRechargeOpen(false);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setRechargeError(err.message || 'Impossibile ricaricare il wallet');
    } finally {
      setRecharging(false);
    }
  }

  const savedVisits = user?.savedVisits?.filter(Boolean) || [];
  const avatarUrl = user?.avatarUrl || DEFAULT_AVATAR;

  return (
    <div className="page-account">
      <PageHeader
        subtitle="Account"
        right={<ProfileMenu user={user} />}
      />

      <main className="account-main">
        <section className="account-heading">
          <span className="kicker">Area personale</span>
          <h1>Il tuo profilo</h1>
          <p>Gestisci visite, preferiti e saldo del tuo account.</p>
        </section>

        {loading && <p className="account-status">Caricamento…</p>}
        {error && !loading && <p className="account-status error">{error}</p>}

        {!loading && !error && (
          <section className="account-dashboard">
            <aside className="account-summary" aria-label="Riepilogo account">
              <img
                className="account-avatar"
                src={avatarUrl}
                alt={`Profilo di ${user?.username || 'utente'}`}
                onError={(event) => {
                  if (!event.currentTarget.src.endsWith(DEFAULT_AVATAR)) {
                    event.currentTarget.src = DEFAULT_AVATAR;
                  }
                }}
              />
              <h2>{user?.username || 'Utente'}</h2>
              <p className="account-email">{user?.email || 'Email non disponibile'}</p>

              <div className="account-wallet">
                <span>Saldo account</span>
                <strong>{formatAmount(user?.walletBalance)} Aα</strong>
                {walletNotice && <p>{walletNotice}</p>}
                <button
                  type="button"
                  className="account-secondary-action"
                  onClick={() => {
                    setRechargeError(null);
                    setRechargeOpen(true);
                  }}
                >
                  Ricarica saldo
                </button>
              </div>

              <button
                type="button"
                className="account-logout"
                onClick={logout}
              >
                Logout
              </button>
            </aside>

            <section className="account-content">
              <div className="account-tabs" role="tablist" aria-label="Sezioni account">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'visits'}
                  className={activeTab === 'visits' ? 'is-active' : ''}
                  onClick={() => setActiveTab('visits')}
                >
                  Le mie visite
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'saved'}
                  className={activeTab === 'saved' ? 'is-active' : ''}
                  onClick={() => setActiveTab('saved')}
                >
                  Salvati
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'settings'}
                  className={activeTab === 'settings' ? 'is-active' : ''}
                  onClick={() => setActiveTab('settings')}
                >
                  Impostazioni
                </button>
              </div>

              <div className="account-panel" role="tabpanel">
                {activeTab === 'visits' && (
                  <>
                    <h2>Visite create</h2>
                    <VisitList
                      visits={visits}
                      emptyMessage="Non hai ancora creato nessuna visita."
                      onStart={navigate}
                    />
                  </>
                )}
                {activeTab === 'saved' && (
                  <>
                    <h2>Visite salvate</h2>
                    <VisitList
                      visits={savedVisits}
                      emptyMessage="Non hai ancora salvato nessuna visita."
                      onStart={navigate}
                    />
                  </>
                )}
                {activeTab === 'settings' && (
                  <>
                    <h2>Dati account</h2>
                    <dl className="account-details">
                      <div>
                        <dt>Username</dt>
                        <dd>{user?.username || '—'}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{user?.email || '—'}</dd>
                      </div>
                    </dl>
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
            <h2 id="recharge-title">Ricarica wallet</h2>
            <p>Saldo attuale: {formatAmount(user?.walletBalance)} Aα</p>
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
              <label htmlFor="recharge-amount">Importo</label>
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
              {rechargeError && <p className="account-modal-error" role="alert">{rechargeError}</p>}
              <div className="account-modal-actions">
                <button
                  type="button"
                  onClick={() => setRechargeOpen(false)}
                  disabled={recharging}
                >
                  Annulla
                </button>
                <button type="submit" disabled={recharging}>
                  {recharging ? 'Ricarica…' : 'Conferma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
