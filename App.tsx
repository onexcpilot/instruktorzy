
import React, { useState, useEffect } from 'react';
import { User, UserRole, Invitation, DocumentRecord } from './types';
import { findUserByEmail, getDb, saveDb, createInvitation, getAllInvitations } from './services/mockDb';
import { ADMIN_EMAIL } from './constants';
import LawSummary from './components/LawSummary';
import DocumentUpload from './components/DocumentUpload';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const LOGO_URL = "https://sierrazulu.waw.pl/wp-content/uploads/2025/03/Podnagloweklustrzane1.png";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [viewingInstructor, setViewingInstructor] = useState<User | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Pobieranie Client ID z Vercela (VITE_...)
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

    const handleCredentialResponse = (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const userEmail = payload.email;
        const userName = payload.name;

        let user = findUserByEmail(userEmail);
        if (!user && userEmail === ADMIN_EMAIL) {
          const db = getDb();
          user = {
            id: 'admin_google',
            email: userEmail,
            fullName: userName,
            role: UserRole.ADMIN,
            documents: [],
            isInvited: false
          };
          db.users.push(user);
          saveDb(db);
        } else if (!user) {
          alert(`Adres ${userEmail} nie ma uprawnień. Poproś o zaproszenie od onexcpilot@gmail.com`);
          return;
        }
        setCurrentUser(user);
      } catch (e) {
        console.error("Błąd dekodowania tokena", e);
      }
    };

    const initGoogle = () => {
      if (!clientId) {
        console.warn("Brak VITE_GOOGLE_CLIENT_ID w zmiennych środowiskowych!");
        return;
      }

      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false
        });

        const btnContainer = document.getElementById("google_login_btn");
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, {
            theme: "outline",
            size: "large",
            width: "320",
            text: "continue_with"
          });
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
      if (window.google && window.google.accounts) {
        initGoogle();
        clearInterval(scriptCheck);
      }
    }, 500);

    return () => clearInterval(scriptCheck);
  }, [currentUser]);

  const createCalendarEvent = async (accessToken: string, doc: DocumentRecord, instructorName: string) => {
    setIsSyncing(true);
    try {
      const event = {
        'summary': `ALARM DTO: Wygasa ${doc.name} - ${instructorName}`,
        'description': `Automatyczne przypomnienie Sierra Zulu Portal. Dokument wymaga odnowienia.`,
        'start': { 'date': doc.expiryDate },
        'end': { 'date': doc.expiryDate },
        'reminders': {
          'useDefault': false,
          'overrides': [
            { 'method': 'email', 'minutes': 24 * 60 * 7 },
            { 'method': 'popup', 'minutes': 24 * 60 }
          ]
        }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (response.ok) {
        alert("TERMIN DODANY: Sprawdź swój kalendarz Google!");
      } else {
        const errData = await response.json();
        console.error(errData);
        alert("Błąd synchronizacji. Upewnij się, że masz uprawnienia do zapisu w kalendarzu.");
      }
    } catch (err) {
      alert("Błąd połączenia z API Google Calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleCalendarSync = (doc: DocumentRecord, instructorName: string) => {
    if (!doc.expiryDate) return;
    if (!tokenClient) {
      alert("Usługi Google nie są jeszcze gotowe. Spróbuj za chwilę.");
      return;
    }
    
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        console.error(resp);
        return;
      }
      await createCalendarEvent(resp.access_token, doc, instructorName);
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    createInvitation(inviteEmail);
    const db = getDb();
    if (!db.users.find(u => u.email === inviteEmail)) {
        db.users.push({
            id: Math.random().toString(36).substring(7),
            email: inviteEmail,
            fullName: 'Instruktor (Oczekuje)',
            role: UserRole.INSTRUCTOR,
            documents: [],
            isInvited: true
        });
        saveDb(db);
    }
    setInviteEmail('');
    alert(`Zaproszenie wysłane na ${inviteEmail}`);
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
    
    if (newDoc.expiryDate && currentUser.role === UserRole.ADMIN) {
        if (confirm("Dodać ten termin jako alarm do Twojego kalendarza Google?")) {
            handleGoogleCalendarSync(newDoc, currentUser.fullName);
        }
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border-t-8 border-blue-600 text-center">
          <img src={LOGO_URL} alt="Sierra Zulu" className="h-24 mx-auto mb-8 object-contain" />
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Sierra Zulu Portal</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-10">DTO Administration System</p>
          
          <div className="flex justify-center mb-8">
            <div id="google_login_btn"></div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest">
              Dostęp tylko dla personelu Sierra Zulu.<br/>Zaloguj się kontem Google.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const instructorVisibleDocs = currentUser.documents.filter(d => !d.isArchived);
  const allInstructors = getDb().users.filter(u => u.role === UserRole.INSTRUCTOR);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
      <aside className="w-full md:w-80 bg-slate-900 text-white p-10 hidden md:flex flex-col">
        <div className="mb-14">
          <img src={LOGO_URL} alt="Logo" className="h-16 mb-4" />
          <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase italic">Aviation Portal</span>
        </div>
        <nav className="flex-1 space-y-4">
          <button onClick={() => {setActiveTab('dashboard'); setViewingInstructor(null);}} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' && !viewingInstructor ? 'bg-blue-600' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-user-pilot"></i><span className="font-black text-xs uppercase italic">Mój Profil</span>
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-blue-600' : 'text-slate-500 hover:text-white'}`}>
              <i className="fas fa-tower-control"></i><span className="font-black text-xs uppercase italic">Instruktorzy</span>
            </button>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800">
          <p className="text-xs font-black uppercase italic">{currentUser.fullName}</p>
          <button onClick={() => setCurrentUser(null)} className="mt-4 text-[10px] font-black text-red-400 uppercase tracking-widest">Wyloguj</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-14 overflow-y-auto">
        {activeTab === 'dashboard' && !viewingInstructor && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header><h1 className="text-5xl font-black text-slate-900 uppercase italic">Dokumentacja</h1></header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8 space-y-8">
                <LawSummary />
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
                   {instructorVisibleDocs.map(doc => (
                     <div key={doc.id} className="flex items-center justify-between p-6 mb-4 bg-slate-50 rounded-3xl hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-slate-100">
                       <div className="flex items-center space-x-4">
                         <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400"><i className="fas fa-file-pdf"></i></div>
                         <div>
                            <p className="font-black text-xs uppercase italic">{doc.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">Ważność: {doc.expiryDate || 'BEZTERMINOWO'}</p>
                         </div>
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
            <header className="flex justify-between items-center">
              <h1 className="text-5xl font-black text-slate-900 uppercase italic">Baza Pilotów</h1>
              <div className="bg-green-50 px-6 py-3 rounded-2xl border border-green-100 text-[10px] font-black text-green-700 uppercase italic">Kalendarz Aktywny</div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
               <div className="lg:col-span-4">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl">
                    <h3 className="font-black text-xs uppercase mb-6 italic">Dodaj instruktora</h3>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <input type="email" required placeholder="Email Google" className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none text-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                      <button className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">Wyślij Zaproszenie</button>
                    </form>
                  </div>
               </div>
               <div className="lg:col-span-8">
                  <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr className="text-left"><th className="p-8">Instruktor</th><th className="p-8 text-right">Akcja</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {allInstructors.map(inst => (
                          <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-8"><p className="font-black text-xs uppercase italic">{inst.fullName}</p><p className="text-[10px] text-slate-400">{inst.email}</p></td>
                            <td className="p-8 text-right">
                              <button onClick={() => setViewingInstructor(inst)} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest">Otwórz</button>
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

        {viewingInstructor && (
          <div className="max-w-4xl mx-auto space-y-8">
            <button onClick={() => setViewingInstructor(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"><i className="fas fa-arrow-left mr-2"></i> Powrót</button>
            <div className="bg-white p-12 rounded-[4rem] shadow-2xl">
              <h2 className="text-4xl font-black uppercase italic mb-10 text-slate-900">{viewingInstructor.fullName}</h2>
              <div className="space-y-4">
                {viewingInstructor.documents.filter(d => !d.isArchived).map(doc => (
                  <div key={doc.id} className="p-8 bg-slate-50 rounded-[2.5rem] flex items-center justify-between border border-transparent hover:border-blue-100 hover:bg-white transition-all group">
                    <div className="flex items-center space-x-6">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-500 shadow-sm"><i className="fas fa-file-contract"></i></div>
                      <div>
                        <p className="font-black text-sm uppercase italic">{doc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Termin: {doc.expiryDate || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      {doc.expiryDate && (
                        <button onClick={() => handleGoogleCalendarSync(doc, viewingInstructor.fullName)} className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-calendar-plus"></i></button>
                      )}
                      <a href={doc.attachments[0]?.fileUrl} target="_blank" className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-eye"></i></a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
