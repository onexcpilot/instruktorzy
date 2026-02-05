
import React, { useState, useEffect } from 'react';
import { User, UserRole, DocumentRecord } from './types';
import { findUserByEmail, getDb, saveDb, createInvitation, updateUser, hashPassword, validatePassword } from './services/mockDb';
import { ADMIN_EMAIL } from './constants';
import LawSummary from './components/LawSummary';
import DocumentUpload from './components/DocumentUpload';

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
    emailjs?: {
      init: (key: string) => void;
      send: (serviceId: string, templateId: string, params: any) => Promise<any>;
    };
  }
}

const LOGO_URL = "https://sierrazulu.waw.pl/wp-content/uploads/2025/03/Podnagloweklustrzane1.png";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'settings'>('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [viewingInstructor, setViewingInstructor] = useState<User | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  
  // Production: EmailJS konfiguracja jest na serwerze (server.js)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [lastInviteInfo, setLastInviteInfo] = useState<{email: string, pass: string, sent: boolean, error?: string} | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [adminChangePass, setAdminChangePass] = useState<{userId: string, pass: string} | null>(null);

  useEffect(() => {
    // Inicjalizacja EmailJS jeśli klucz jest dostępny
    if (emailConfig.publicKey && window.emailjs) {
      window.emailjs.init(emailConfig.publicKey);
    }

    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    const handleCredentialResponse = (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const userEmail = payload.email;
        let user = findUserByEmail(userEmail);
        
        if (!user && userEmail === ADMIN_EMAIL) {
          const db = getDb();
          user = {
            id: 'admin_google',
            email: userEmail,
            fullName: payload.name,
            role: UserRole.ADMIN,
            documents: [],
            isInvited: false,
            password: 'sierra'
          };
          db.users.push(user);
          saveDb(db);
        } else if (!user) {
          alert(`Brak uprawnień. Admin musi dodać Twój email do bazy.`);
          return;
        }
        setCurrentUser(user);
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
  }, [currentUser, emailConfig.publicKey]);

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = findUserByEmail(loginEmail);
    if (user && validatePassword(loginPass, user.password)) {
      setCurrentUser(user);
      setLoginEmail('');
      setLoginPass('');
    } else {
      alert("Błędny e-mail lub hasło.");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Podaj poprawny adres email');
      return;
    }
    setIsSending(true);
    const tempPass = 'Temp' + Math.random().toString(36).substring(2, 10).toUpperCase(); 
    const targetEmail = inviteEmail;

    // 1. Dodanie do bazy
    const db = getDb();
    if (!db.users.find(u => u.email === targetEmail)) {
        db.users.push({
            id: Math.random().toString(36).substring(7),
            email: targetEmail,
            password: hashPassword(tempPass),
            fullName: targetEmail.split('@')[0],
            role: UserRole.INSTRUCTOR,
            documents: [],
            isInvited: true
        });
        saveDb(db);
    }

    // 2. Wysyłka e-maila przez backend
    let emailSent = false;
    let errorMsg = undefined;

    try {
      const response = await fetch(`${API_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: targetEmail,
          password: tempPass,
          link: window.location.origin
        })
      });

      if (response.ok) {
        emailSent = true;
      } else {
        errorMsg = "Błąd wysyłki emaila. Skopiuj dane ręcznie.";
      }
    } catch (err) {
      console.error("Email API Error:", err);
      errorMsg = "Brak dostępu do serwera email. Wysyłka tylko ręczna.";
    }

    setLastInviteInfo({ email: targetEmail, pass: tempPass, sent: emailSent, error: errorMsg });
    setInviteEmail('');
    setIsSending(false);
  };

  const handleGoogleCalendarSync = (doc: DocumentRecord, instructorName: string) => {
    if (!tokenClient) return alert("Błąd: Google Client nie gotowy.");

    tokenClient.callback = async (response: any) => {
      if (response.error) return;

      const event = {
        'summary': `ALARM DTO: Wygasa ${doc.name} - ${instructorName}`,
        'description': `Wygasający dokument: ${doc.name}`,
        'start': { 'date': doc.expiryDate },
        'end': { 'date': doc.expiryDate },
        'reminders': {
          'useDefault': false,
          'overrides': [{ 'method': 'email', 'minutes': 10080 }] // 7 dni wcześniej
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
        if (res.ok) alert("Pomyślnie dodano do kalendarza!");
      } catch (err) { alert("Błąd synchronizacji."); }
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleAdminResetPass = (userId: string) => {
    if (!adminChangePass) return;
    const db = getDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      db.users[userIndex].password = adminChangePass.pass;
      saveDb(db);
      setAdminChangePass(null);
      alert("Hasło zmienione.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Skopiowano do schowka!");
  };

  const handleDocUpload = (newDoc: DocumentRecord) => {
    if (!currentUser) return;
    const db = getDb();
    const updatedUsers = db.users.map(u => {
      if (u.id === currentUser.id) {
        const updatedDocs = u.documents.map(d => d.type === newDoc.type ? { ...d, isArchived: true } : d);
        return { ...u, documents: [...updatedDocs, { ...newDoc, isArchived: false }] };
      }
      return u;
    });
    db.users = updatedUsers;
    saveDb(db);
    setCurrentUser(updatedUsers.find(u => u.id === currentUser.id) || null);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-inter">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-lg border-t-8 border-blue-600 text-center">
          <img src={LOGO_URL} alt="Sierra Zulu" className="h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-black uppercase italic mb-8">Sierra Zulu Portal</h1>
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
               <input type="email" placeholder="Email" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-center" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
               <input type="password" placeholder="Hasło" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-center" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
               <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-xl">Zaloguj się</button>
          </form>
          <div className="relative flex py-2 items-center mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase">lub</span>
              <div className="flex-grow border-t border-slate-200"></div>
          </div>
          <div id="google_login_btn"></div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const allInstructors = getDb().users.filter(u => u.role === UserRole.INSTRUCTOR);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
      <aside className="w-full md:w-80 bg-slate-900 text-white p-10 hidden md:flex flex-col">
        <div className="mb-14">
          <img src={LOGO_URL} alt="Logo" className="h-12 mb-4" />
          <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase italic">Aviation Portal</span>
        </div>
        <nav className="flex-1 space-y-4">
          <button onClick={() => {setActiveTab('dashboard'); setViewingInstructor(null);}} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' && !viewingInstructor ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-user-pilot"></i><span className="font-black text-xs uppercase italic">Mój Profil</span>
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
              <i className="fas fa-tower-control"></i><span className="font-black text-xs uppercase italic">Instruktorzy</span>
            </button>
          )}
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-cog"></i><span className="font-black text-xs uppercase italic">Ustawienia</span>
          </button>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800">
          <p className="text-[10px] font-black uppercase italic text-blue-400">{currentUser.fullName}</p>
          <button onClick={() => setCurrentUser(null)} className="mt-4 text-[9px] font-black text-red-400 uppercase tracking-widest">Wyloguj się</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-14 overflow-y-auto">
        {activeTab === 'dashboard' && !viewingInstructor && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header><h1 className="text-4xl font-black text-slate-900 uppercase italic">Moje Dokumenty</h1></header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8 space-y-8">
                <LawSummary />
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-4">
                   {currentUser.documents.filter(d => !d.isArchived).map(doc => (
                     <div key={doc.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl">
                       <div>
                            <p className="font-black text-xs uppercase italic">{doc.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">Termin: {doc.expiryDate || 'Bezterminowo'}</p>
                       </div>
                       <a href={doc.attachments[0]?.fileUrl} target="_blank" className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><i className="fas fa-eye"></i></a>
                     </div>
                   ))}
                </div>
              </div>
              <div className="lg:col-span-4"><DocumentUpload onUpload={handleDocUpload} /></div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header className="flex justify-between items-center"><h1 className="text-4xl font-black text-slate-900 uppercase italic">Baza Pilotów</h1></header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
               <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="font-black text-xs uppercase mb-6 italic text-blue-600">Zaproś nowego</h3>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <input type="email" required placeholder="E-mail instruktora" className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                      <button disabled={isSending} className={`w-full ${isSending ? 'bg-slate-400' : 'bg-blue-600'} text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg transition-all`}>
                        {isSending ? 'Trwa wysyłka...' : 'Zaproś Instruktora'}
                      </button>
                    </form>
                  </div>
                  {lastInviteInfo && (
                    <div className={`p-8 rounded-[2.5rem] border ${lastInviteInfo.sent ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                        <h4 className={`text-[10px] font-black uppercase mb-3 ${lastInviteInfo.sent ? 'text-green-700' : 'text-orange-700'}`}>
                            {lastInviteInfo.sent ? 'Zaproszenie wysłane!' : 'Błąd wysyłki automatu'}
                        </h4>
                        <div className="bg-white p-4 rounded-xl text-[10px] font-mono break-all mb-4">
                            Login: {lastInviteInfo.email}<br/>Hasło: {lastInviteInfo.pass}
                        </div>
                        <button onClick={() => copyToClipboard(`Zaproszenie Sierra Zulu:\nLogin: ${lastInviteInfo.email}\nHasło: ${lastInviteInfo.pass}\nLink: ${window.location.origin}`)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-[9px] font-black uppercase">Skopiuj dane ręcznie</button>
                    </div>
                  )}
               </div>
               <div className="lg:col-span-8">
                  <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr className="text-left"><th className="p-8">Instruktor</th><th className="p-8 text-right">Opcje</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {allInstructors.map(inst => (
                          <tr key={inst.id} className="hover:bg-slate-50/50">
                            <td className="p-8"><p className="font-black text-xs uppercase italic">{inst.fullName}</p><p className="text-[10px] text-slate-400">{inst.email}</p></td>
                            <td className="p-8 text-right space-x-2">
                                <button onClick={() => setViewingInstructor(inst)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Akta</button>
                                <button onClick={() => setAdminChangePass({userId: inst.id, pass: ''})} className="bg-blue-50 text-blue-600 px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Hasło</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-4xl font-black text-slate-900 uppercase italic">Ustawienia</h1>
            <div className="bg-blue-50 border border-blue-200 p-8 rounded-[2.5rem]">
              <h3 className="font-black text-sm text-blue-900 mb-3">✅ Production Mode</h3>
              <p className="text-sm text-blue-700">EmailJS i Google Calendar są skonfigurowane na serwerze. Wysyłka emaili i synchronizacja kalendarza pracują automatycznie.</p>
            </div>
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
                <h2 className="font-black text-sm uppercase mb-6 italic">Zmiana Hasła</h2>
                <input type="password" placeholder="Nowe hasło" className="w-full p-4 bg-slate-50 rounded-xl text-sm mb-4" value={newPass} onChange={e => setNewPass(e.target.value)} />
                <button onClick={() => {if(newPass.length>=8){const db = getDb(); const updated = {...currentUser!, password: hashPassword(newPass)}; updateUser(updated); setCurrentUser(updated); setNewPass(''); alert("Hasło zmieniono!");} else alert('Min. 8 znaków')}} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">Zaktualizuj Moje Hasło</button>
            </div>
          </div>
        )}

        {viewingInstructor && (
          <div className="max-w-4xl mx-auto space-y-8">
            <button onClick={() => setViewingInstructor(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"><i className="fas fa-arrow-left mr-2"></i> Powrót do listy</button>
            <div className="bg-white p-12 rounded-[4rem] shadow-2xl">
              <h2 className="text-4xl font-black uppercase italic mb-10">{viewingInstructor.fullName}</h2>
              <div className="space-y-4">
                {viewingInstructor.documents.filter(d => !d.isArchived).map(doc => (
                  <div key={doc.id} className="p-8 bg-slate-50 rounded-[2.5rem] flex items-center justify-between">
                    <div><p className="font-black text-sm uppercase italic">{doc.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Wygasa: {doc.expiryDate || 'N/A'}</p></div>
                    <div className="flex space-x-3">
                      {doc.expiryDate && (
                        <button onClick={() => handleGoogleCalendarSync(doc, viewingInstructor.fullName)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-calendar-plus"></i></button>
                      )}
                      <a href={doc.attachments[0]?.fileUrl} target="_blank" className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-eye"></i></a>
                    </div>
                  </div>
                ))}
                {viewingInstructor.documents.length === 0 && <p className="text-center py-10 text-slate-400 uppercase font-black text-xs">Brak wgranych dokumentów</p>}
              </div>
            </div>
          </div>
        )}

        {adminChangePass && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md text-center">
                    <h3 className="text-xl font-black uppercase italic mb-6">Ustaw nowe hasło</h3>
                    <input type="text" placeholder="Wpisz nowe hasło" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-center font-bold mb-6" value={adminChangePass.pass} onChange={e => setAdminChangePass({...adminChangePass, pass: e.target.value})} />
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
