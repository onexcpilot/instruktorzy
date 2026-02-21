
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, DocumentRecord } from './types';
import { ADMIN_EMAIL } from './constants';
import { scanAllExpiries, getAlertsSummary, computeDocumentStatus } from './services/expiryChecker';
import {
  apiLogin,
  apiChangePassword,
  apiGetUser,
  apiGetInstructors,
  apiInvite,
  apiAdminResetPassword,
} from './services/api';
import LawSummary from './components/LawSummary';
import DocumentUpload from './components/DocumentUpload';
import NotificationDashboard from './components/NotificationDashboard';
import ExpiryAlertBanner from './components/ExpiryAlertBanner';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement | null, config: any) => void;
        };
        oauth2: {
          initTokenClient: (config: any) => any;
        };
      };
    };
    gapi?: any;
  }
}

const LOGO_URL = "https://sierrazulu.waw.pl/wp-content/uploads/2025/03/Podnagloweklustrzane1.png";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'notifications' | 'settings'>('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [viewingInstructor, setViewingInstructor] = useState<User | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [allInstructors, setAllInstructors] = useState<User[]>([]);
  const [isLoadingInstructors, setIsLoadingInstructors] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lastInviteInfo, setLastInviteInfo] = useState<{ email: string, pass: string, sent: boolean, error?: string } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [adminChangePass, setAdminChangePass] = useState<{ userId: string, pass: string } | null>(null);

  // Pobranie listy instruktorow z API
  const fetchInstructors = useCallback(async () => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) return;
    setIsLoadingInstructors(true);
    try {
      const data = await apiGetInstructors();
      setAllInstructors(data);
    } catch (err) {
      console.error('Failed to fetch instructors:', err);
    }
    setIsLoadingInstructors(false);
  }, [currentUser]);

  // Odswiezenie danych zalogowanego usera
  const refreshCurrentUser = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await apiGetUser(currentUser.id);
      setCurrentUser(data);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [currentUser]);

  // Po zalogowaniu: pobierz instruktorow (jesli admin)
  useEffect(() => {
    if (currentUser?.role === UserRole.ADMIN) {
      fetchInstructors();
    }
  }, [currentUser?.id, currentUser?.role, fetchInstructors]);

  // Google OAuth init
  useEffect(() => {
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    const handleCredentialResponse = async (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const userEmail = payload.email;

        // Probujemy zalogowac - Google OAuth uzytkownicy musza byc w bazie
        // Admin moze byc wstepnie dodany przez SQL
        try {
          const result = await apiLogin(userEmail, '__google_oauth__');
          setCurrentUser(result.user);
        } catch {
          alert('Brak uprawnien. Admin musi dodac Twoj email do bazy.');
        }
      } catch (e) { console.error(e); }
    };

    const initGoogle = () => {
      if (window.google && clientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false
          });
          const btnContainer = document.getElementById("google_login_btn");
          if (btnContainer) {
            window.google.accounts.id.renderButton(btnContainer, { theme: "outline", size: "large", width: "320" });
          }
        } catch (err) {
          console.error('Google init error:', err);
        }
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: CALENDAR_SCOPE,
          callback: '',
        });
        setTokenClient(client);
      }
    };

    const scriptCheck = setInterval(() => {
      if (window.google?.accounts) {
        initGoogle();
        clearInterval(scriptCheck);
      }
    }, 500);
    return () => clearInterval(scriptCheck);
  }, [currentUser]);

  // =============================================
  // Handlers
  // =============================================

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const result = await apiLogin(loginEmail, loginPass);
      setCurrentUser(result.user);
      setLoginEmail('');
      setLoginPass('');
    } catch (err: any) {
      setLoginError(err.message || 'Bledny e-mail lub haslo.');
    }
    setIsLoggingIn(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Podaj poprawny adres email');
      return;
    }
    setIsSending(true);

    try {
      const result = await apiInvite(inviteEmail);
      setLastInviteInfo({
        email: result.email,
        pass: result.tempPass,
        sent: result.emailSent,
        error: result.error || undefined,
      });
      setInviteEmail('');
      // Odswiezenie listy
      fetchInstructors();
    } catch (err: any) {
      setLastInviteInfo({
        email: inviteEmail,
        pass: '---',
        sent: false,
        error: err.message || 'Blad zaproszenia',
      });
    }
    setIsSending(false);
  };

  const handleGoogleCalendarSync = (doc: DocumentRecord, instructorName: string) => {
    if (!tokenClient) return alert("Blad: Google Client nie gotowy.");

    tokenClient.callback = async (response: any) => {
      if (response.error) return;

      const event = {
        'summary': `ALARM DTO: Wygasa ${doc.name} - ${instructorName}`,
        'description': `Wygasajacy dokument: ${doc.name}`,
        'start': { 'date': doc.expiryDate },
        'end': { 'date': doc.expiryDate },
        'reminders': {
          'useDefault': false,
          'overrides': [{ 'method': 'email', 'minutes': 10080 }]
        }
      };

      try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${response.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        });
        if (res.ok) alert("Pomyslnie dodano do kalendarza!");
      } catch { alert("Blad synchronizacji."); }
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleAdminResetPass = async (userId: string) => {
    if (!adminChangePass || !adminChangePass.pass) return;
    if (adminChangePass.pass.length < 8) {
      alert('Haslo musi miec minimum 8 znakow.');
      return;
    }

    try {
      await apiAdminResetPassword(userId, adminChangePass.pass);
      setAdminChangePass(null);
      alert("Haslo zmienione.");
    } catch (err: any) {
      alert(`Blad: ${err.message}`);
    }
  };

  const handleChangeOwnPassword = async () => {
    if (newPass.length < 8) {
      alert('Min. 8 znakow');
      return;
    }
    try {
      await apiChangePassword(currentUser!.id, newPass);
      setNewPass('');
      alert('Haslo zmieniono!');
    } catch (err: any) {
      alert(`Blad: ${err.message}`);
    }
  };

  const handleDocUpload = async () => {
    // Po uploadzie (obslugiwany teraz przez DocumentUpload -> API), odswiezamy usera
    await refreshCurrentUser();
    if (currentUser?.role === UserRole.ADMIN) {
      await fetchInstructors();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Skopiowano do schowka!");
  };

  // =============================================
  // LOGIN SCREEN
  // =============================================

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-inter">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-lg border-t-8 border-blue-600 text-center">
          <img src={LOGO_URL} alt="Sierra Zulu" className="h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-black uppercase italic mb-8">Sierra Zulu Portal</h1>
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <input type="email" placeholder="Email" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-center" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            <input type="password" placeholder="Haslo" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-center" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
            <button type="submit" disabled={isLoggingIn} className={`w-full font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-xl transition-all ${isLoggingIn ? 'bg-slate-400 text-slate-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
              {isLoggingIn ? 'Logowanie...' : 'Zaloguj sie'}
            </button>
          </form>
          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase">lub</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
          <div className="flex justify-center"><div id="google_login_btn"></div></div>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN APP
  // =============================================

  const isAdmin = currentUser.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
      <aside className="w-full md:w-80 bg-slate-900 text-white p-10 hidden md:flex flex-col">
        <div className="mb-14">
          <img src={LOGO_URL} alt="Logo" className="h-12 mb-4" />
          <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase italic">Aviation Portal</span>
        </div>
        <nav className="flex-1 space-y-4">
          <button onClick={() => { setActiveTab('dashboard'); setViewingInstructor(null); }} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' && !viewingInstructor ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-user-pilot"></i><span className="font-black text-xs uppercase italic">Moj Profil</span>
          </button>
          {isAdmin && (
            <>
              <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                <i className="fas fa-tower-control"></i><span className="font-black text-xs uppercase italic">Instruktorzy</span>
              </button>
              <button onClick={() => { setActiveTab('notifications'); setViewingInstructor(null); }} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all relative ${activeTab === 'notifications' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                <i className="fas fa-bell"></i>
                <span className="font-black text-xs uppercase italic">Powiadomienia</span>
                {(() => {
                  const alertsSummary = getAlertsSummary(scanAllExpiries(allInstructors));
                  const urgentCount = alertsSummary.expired + alertsSummary.critical;
                  return urgentCount > 0 ? (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{urgentCount}</span>
                  ) : null;
                })()}
              </button>
            </>
          )}
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-cog"></i><span className="font-black text-xs uppercase italic">Ustawienia</span>
          </button>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800">
          <p className="text-[10px] font-black uppercase italic text-blue-400">{currentUser.fullName}</p>
          <button onClick={() => setCurrentUser(null)} className="mt-4 text-[9px] font-black text-red-400 uppercase tracking-widest">Wyloguj sie</button>
        </div>
      </aside>

      {/* Mobile navigation */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 p-4 text-white">
        <img src={LOGO_URL} alt="Logo" className="h-8" />
        <div className="flex gap-2">
          <button onClick={() => { setActiveTab('dashboard'); setViewingInstructor(null); }} className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase ${activeTab === 'dashboard' ? 'bg-blue-600' : 'bg-slate-800'}`}>Profil</button>
          {isAdmin && <button onClick={() => setActiveTab('admin')} className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase ${activeTab === 'admin' ? 'bg-blue-600' : 'bg-slate-800'}`}>Piloci</button>}
          {isAdmin && (
            <button onClick={() => { setActiveTab('notifications'); setViewingInstructor(null); }} className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase relative ${activeTab === 'notifications' ? 'bg-blue-600' : 'bg-slate-800'}`}>
              <i className="fas fa-bell"></i>
              {(() => {
                const s = getAlertsSummary(scanAllExpiries(allInstructors));
                return (s.expired + s.critical) > 0 ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[7px] font-black rounded-full flex items-center justify-center">{s.expired + s.critical}</span> : null;
              })()}
            </button>
          )}
          <button onClick={() => setActiveTab('settings')} className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase ${activeTab === 'settings' ? 'bg-blue-600' : 'bg-slate-800'}`}><i className="fas fa-cog"></i></button>
          <button onClick={() => setCurrentUser(null)} className="px-3 py-2 rounded-xl text-[8px] font-black uppercase bg-red-900"><i className="fas fa-sign-out-alt"></i></button>
        </div>
      </div>

      <main className="flex-1 p-6 md:p-14 overflow-y-auto">
        {activeTab === 'dashboard' && !viewingInstructor && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header><h1 className="text-4xl font-black text-slate-900 uppercase italic">Moje Dokumenty</h1></header>
            <ExpiryAlertBanner user={currentUser} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8 space-y-8">
                <LawSummary />
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-4">
                  {(currentUser.documents || []).filter(d => !d.isArchived).map(doc => {
                    const status = computeDocumentStatus(doc);
                    const isExpired = status === 'expired';
                    const docBg = isExpired ? 'bg-red-50 border border-red-200' : 'bg-slate-50';
                    return (
                      <div key={doc.id} className={`flex items-center justify-between p-6 ${docBg} rounded-3xl`}>
                        <div>
                          <p className="font-black text-xs uppercase italic">{doc.name}</p>
                          <p className={`text-[9px] font-bold ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
                            Termin: {doc.expiryDate || 'Bezterminowo'}
                            {isExpired && ' - WYGASLO'}
                          </p>
                        </div>
                        {doc.attachments?.[0]?.fileUrl && (
                          <a href={doc.attachments[0].fileUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><i className="fas fa-eye"></i></a>
                        )}
                      </div>
                    );
                  })}
                  {(!currentUser.documents || currentUser.documents.filter(d => !d.isArchived).length === 0) && (
                    <p className="text-center py-10 text-slate-400 uppercase font-black text-xs">Brak wgranych dokumentow</p>
                  )}
                </div>
              </div>
              <div className="lg:col-span-4">
                <DocumentUpload userId={currentUser.id} onUploadComplete={handleDocUpload} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header className="flex justify-between items-center">
              <h1 className="text-4xl font-black text-slate-900 uppercase italic">Baza Pilotow</h1>
              <button onClick={fetchInstructors} disabled={isLoadingInstructors} className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-800">
                <i className={`fas ${isLoadingInstructors ? 'fa-spinner fa-spin' : 'fa-sync-alt'} mr-2`}></i>Odswiez
              </button>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                  <h3 className="font-black text-xs uppercase mb-6 italic text-blue-600">Zapros nowego</h3>
                  <form onSubmit={handleInvite} className="space-y-4">
                    <input type="email" required placeholder="E-mail instruktora" className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    <button disabled={isSending} className={`w-full ${isSending ? 'bg-slate-400' : 'bg-blue-600'} text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg transition-all`}>
                      {isSending ? 'Trwa wysylka...' : 'Zapros Instruktora'}
                    </button>
                  </form>
                </div>
                {lastInviteInfo && (
                  <div className={`p-8 rounded-[2.5rem] border ${lastInviteInfo.sent ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                    <h4 className={`text-[10px] font-black uppercase mb-3 ${lastInviteInfo.sent ? 'text-green-700' : 'text-orange-700'}`}>
                      {lastInviteInfo.sent ? 'Zaproszenie wyslane!' : 'Blad wysylki automatu'}
                    </h4>
                    <div className="bg-white p-4 rounded-xl text-[10px] font-mono break-all mb-4">
                      Login: {lastInviteInfo.email}<br />Haslo: {lastInviteInfo.pass}
                    </div>
                    <button onClick={() => copyToClipboard(`Zaproszenie Sierra Zulu:\nLogin: ${lastInviteInfo.email}\nHaslo: ${lastInviteInfo.pass}\nLink: https://instruktor.sierrazulu.waw.pl`)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-[9px] font-black uppercase">Skopiuj dane recznie</button>
                  </div>
                )}
              </div>
              <div className="lg:col-span-8">
                <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden">
                  {isLoadingInstructors ? (
                    <div className="p-12 text-center">
                      <i className="fas fa-spinner fa-spin text-2xl text-slate-300 mb-4"></i>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Ladowanie instruktorow...</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr className="text-left"><th className="p-8">Instruktor</th><th className="p-8">Status dok.</th><th className="p-8 text-right">Opcje</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {allInstructors.map(inst => {
                          const instAlerts = scanAllExpiries([inst]);
                          const instSummary = getAlertsSummary(instAlerts);
                          const hasUrgent = instSummary.expired > 0 || instSummary.critical > 0;
                          const hasWarning = instSummary.warning > 0;
                          return (
                            <tr key={inst.id} className={`hover:bg-slate-50/50 ${hasUrgent ? 'bg-red-50/30' : ''}`}>
                              <td className="p-8"><p className="font-black text-xs uppercase italic">{inst.fullName}</p><p className="text-[10px] text-slate-400">{inst.email}</p></td>
                              <td className="p-8">
                                {instAlerts.length === 0 ? (
                                  <span className="text-[9px] font-black text-green-600 uppercase">OK</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {instSummary.expired > 0 && <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[8px] font-black">{instSummary.expired} wygasle</span>}
                                    {instSummary.critical > 0 && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-[8px] font-black">{instSummary.critical} pilne</span>}
                                    {hasWarning && <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[8px] font-black">{instSummary.warning} ostrz.</span>}
                                  </div>
                                )}
                              </td>
                              <td className="p-8 text-right space-x-2">
                                <button onClick={() => setViewingInstructor(inst)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Akta</button>
                                <button onClick={() => setAdminChangePass({ userId: inst.id, pass: '' })} className="bg-blue-50 text-blue-600 px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Haslo</button>
                              </td>
                            </tr>
                          );
                        })}
                        {allInstructors.length === 0 && (
                          <tr><td colSpan={3} className="p-12 text-center text-slate-400 text-xs font-black uppercase">Brak instruktorow</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && isAdmin && (
          <div className="max-w-6xl mx-auto">
            <NotificationDashboard
              users={allInstructors}
              onViewInstructor={(inst) => { setViewingInstructor(inst); setActiveTab('dashboard'); }}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-4xl font-black text-slate-900 uppercase italic">Ustawienia</h1>
            <div className="bg-blue-50 border border-blue-200 p-8 rounded-[2.5rem]">
              <h3 className="font-black text-sm text-blue-900 mb-3">Production Mode</h3>
              <p className="text-sm text-blue-700">Dane zapisywane w bazie MySQL. Emaile wysylane przez SMTP sierrazulu.waw.pl.</p>
            </div>
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-sm uppercase mb-6 italic">Zmiana Hasla</h2>
              <input type="password" placeholder="Nowe haslo" className="w-full p-4 bg-slate-50 rounded-xl text-sm mb-4" value={newPass} onChange={e => setNewPass(e.target.value)} />
              <button onClick={handleChangeOwnPassword} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">Zaktualizuj Moje Haslo</button>
            </div>
          </div>
        )}

        {viewingInstructor && (
          <div className="max-w-4xl mx-auto space-y-8">
            <button onClick={() => setViewingInstructor(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"><i className="fas fa-arrow-left mr-2"></i> Powrot do listy</button>
            <div className="bg-white p-12 rounded-[4rem] shadow-2xl">
              <h2 className="text-4xl font-black uppercase italic mb-10">{viewingInstructor.fullName}</h2>
              <div className="space-y-4">
                {(viewingInstructor.documents || []).filter(d => !d.isArchived).map(doc => {
                  const docStatus = computeDocumentStatus(doc);
                  const isExp = docStatus === 'expired';
                  return (
                    <div key={doc.id} className={`p-8 ${isExp ? 'bg-red-50 border border-red-200' : 'bg-slate-50'} rounded-[2.5rem] flex items-center justify-between`}>
                      <div>
                        <p className="font-black text-sm uppercase italic">{doc.name}</p>
                        <p className={`text-[10px] font-bold uppercase mt-1 ${isExp ? 'text-red-500' : 'text-slate-400'}`}>
                          Wygasa: {doc.expiryDate || 'N/A'} {isExp && '- WYGASLO'}
                        </p>
                      </div>
                      <div className="flex space-x-3">
                        {doc.expiryDate && (
                          <button onClick={() => handleGoogleCalendarSync(doc, viewingInstructor.fullName)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-calendar-plus"></i></button>
                        )}
                        {doc.attachments?.[0]?.fileUrl && (
                          <a href={doc.attachments[0].fileUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-eye"></i></a>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!viewingInstructor.documents || viewingInstructor.documents.length === 0) && <p className="text-center py-10 text-slate-400 uppercase font-black text-xs">Brak wgranych dokumentow</p>}
              </div>
            </div>
          </div>
        )}

        {adminChangePass && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center">
              <h3 className="text-xl font-black uppercase italic mb-6">Ustaw nowe haslo</h3>
              <input type="text" placeholder="Wpisz nowe haslo" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-center font-bold mb-6" value={adminChangePass.pass} onChange={e => setAdminChangePass({ ...adminChangePass, pass: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setAdminChangePass(null)} className="py-4 text-[10px] font-black uppercase text-slate-400">Anuluj</button>
                <button onClick={() => handleAdminResetPass(adminChangePass.userId)} className="bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">Zapisz</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
