
import React, { useState, useEffect } from 'react';
import { User, UserRole, Invitation, DocumentRecord } from './types';
import { findUserByEmail, getDb, saveDb, createInvitation, getAllInvitations, acceptInvitation } from './services/mockDb';
import { ADMIN_EMAIL, DOCUMENT_LABELS } from './constants';
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
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inicjalizacja Google Services
  useEffect(() => {
    // Pobierz Client ID z env (Vercel) lub użyj placeholderu dla testów lokalnych
    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "TWÓJ_IDENTYFIKATOR_KLIENTA";

    const handleCredentialResponse = (response: any) => {
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
        alert("Brak uprawnień. Poproś Administratora (onexcpilot@gmail.com) o zaproszenie na ten adres email.");
        return;
      }
      setCurrentUser(user);
    };

    const initGoogle = () => {
      if (window.google) {
        // Logowanie
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse
        });

        window.google.accounts.id.renderButton(
          document.getElementById("google_login_btn"),
          { theme: "outline", size: "large", width: "100%", text: "continue_with" }
        );

        // Klient tokena dla Kalendarza (OAuth2)
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: CALENDAR_SCOPE,
          callback: '', // Nadpiszemy przy wywołaniu
        });
        setTokenClient(client);
      }
    };

    // Poczekaj na załadowanie skryptów
    const timer = setTimeout(initGoogle, 1000);
    return () => clearTimeout(timer);
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'admin') {
      setInvitations(getAllInvitations());
    }
  }, [activeTab]);

  const createCalendarEvent = async (accessToken: string, doc: DocumentRecord, instructorName: string) => {
    setIsSyncing(true);
    try {
      const event = {
        'summary': `ALARM DTO: Wygasa ${doc.name} - ${instructorName}`,
        'description': `Automatyczne przypomnienie Sierra Zulu Portal. Dokument wgrany przez instruktora wymaga weryfikacji lub odnowienia.`,
        'start': { 'date': doc.expiryDate },
        'end': { 'date': doc.expiryDate },
        'reminders': {
          'useDefault': false,
          'overrides': [
            { 'method': 'email', 'minutes': 24 * 60 * 7 }, // 7 dni przed
            { 'method': 'popup', 'minutes': 24 * 60 }      // 1 dzień przed
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
        alert("Sukces! Przypomnienie zostało dodane do Twojego kalendarza Google.");
      } else {
        throw new Error("Błąd API Google");
      }
    } catch (err) {
      alert("Nie udało się dodać wydarzenia do kalendarza.");
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleCalendarSync = (doc: DocumentRecord, instructorName: string) => {
    if (!doc.expiryDate) return;
    
    // Poproś o token tylko gdy jest potrzebny
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) throw (resp);
      await createCalendarEvent(resp.access_token, doc, instructorName);
    };

    if (window.gapi.client?.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
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
            fullName: 'Oczekujący Instruktor',
            role: UserRole.INSTRUCTOR,
            documents: [],
            isInvited: true
        });
        saveDb(db);
    }
    setInvitations(getAllInvitations());
    alert(`Zaproszenie wysłane na ${inviteEmail}`);
    setInviteEmail('');
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
        if (confirm("Dodaj ten termin do swojego kalendarza Google?")) {
            handleGoogleCalendarSync(newDoc, currentUser.fullName);
        }
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setViewingInstructor(null);
    setActiveTab('dashboard');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border-t-8 border-blue-600">
          <div className="text-center mb-10">
            <img src={LOGO_URL} alt="Aviation Sierra Zulu" className="h-20 mx-auto mb-6 object-contain" />
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Sierra Zulu Portal</h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-3">Personnel Management System</p>
          </div>
          
          <div className="space-y-8">
            <div id="google_login_btn" className="w-full min-h-[50px] flex justify-center">
                {/* Google Sign-In Button renders here */}
                <div className="animate-pulse bg-slate-100 h-12 w-full rounded-xl"></div>
            </div>

            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <p className="text-[10px] text-blue-700 font-bold text-center leading-relaxed uppercase tracking-widest">
                    Logowanie wyłącznie dla zweryfikowanych adresów Google.
                </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const instructorVisibleDocs = currentUser.documents.filter(d => !d.isArchived);
  const allInstructors = getDb().users.filter(u => u.role === UserRole.INSTRUCTOR);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-slate-900 text-white p-10 hidden md:flex flex-col border-r border-slate-800">
        <div className="mb-14">
          <img src={LOGO_URL} alt="Sierra Zulu" className="h-16 w-auto object-contain mb-4" />
          <div className="px-4 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full inline-block">
             <span className="text-[10px] font-black text-blue-400 tracking-[0.2em] uppercase italic">Aviation Portal</span>
          </div>
        </div>
        
        <nav className="flex-1 space-y-4">
          <button 
            onClick={() => {setActiveTab('dashboard'); setViewingInstructor(null);}}
            className={`w-full flex items-center space-x-5 px-6 py-4.5 rounded-2xl transition-all ${activeTab === 'dashboard' && !viewingInstructor ? 'bg-blue-600 shadow-xl shadow-blue-900/40 text-white' : 'text-slate-500 hover:bg-slate-800/50 hover:text-white'}`}
          >
            <i className={`fas fa-user-pilot text-lg ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-700'}`}></i>
            <span className="font-black text-xs uppercase tracking-widest">Mój Profil</span>
          </button>
          
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center space-x-5 px-6 py-4.5 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-blue-600 shadow-xl shadow-blue-900/40 text-white' : 'text-slate-500 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <i className={`fas fa-tower-control text-lg ${activeTab === 'admin' ? 'text-white' : 'text-slate-700'}`}></i>
              <span className="font-black text-xs uppercase tracking-widest">Zarządzanie</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-10 border-t border-slate-800">
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-black text-lg shadow-xl uppercase italic">
                {currentUser.fullName.charAt(0)}
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-black truncate text-white uppercase italic">{currentUser.fullName}</p>
                <p className="text-[10px] text-slate-500 truncate font-bold uppercase tracking-wider">{isAdmin ? 'Admin' : 'Instruktor'}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full bg-slate-800/40 text-slate-500 py-4 rounded-2xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all uppercase tracking-[0.2em] border border-slate-700/50">
            Wyloguj Się
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-14 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'dashboard' && !viewingInstructor && (
             <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <header className="mb-12">
                   <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Dokumentacja</h1>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-4 flex items-center">
                     <span className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse"></span>
                     Połączono z bazą Sierra Zulu
                   </p>
                </header>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-8 space-y-12">
                      <LawSummary />
                      <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 p-10">
                         <div className="flex items-center justify-between mb-8">
                            <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest italic">Wykaz dokumentów</h3>
                            <span className="text-[10px] text-slate-300 font-bold">Max 10MB per file</span>
                         </div>
                         <div className="space-y-4">
                            {instructorVisibleDocs.map(doc => (
                               <div key={doc.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
                                  <div className="flex items-center space-x-6">
                                     <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-colors shadow-sm"><i className="fas fa-file-alt"></i></div>
                                     <div>
                                        <p className="font-black text-slate-900 uppercase italic text-xs">{doc.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold">Ważność: <span className={doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'text-red-600' : 'text-slate-900'}>{doc.expiryDate || 'Bezterminowo'}</span></p>
                                     </div>
                                  </div>
                                  <div className="flex gap-2">
                                     <a href={doc.attachments[0]?.fileUrl} target="_blank" className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all"><i className="fas fa-eye"></i></a>
                                  </div>
                               </div>
                            ))}
                            {instructorVisibleDocs.length === 0 && (
                                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                    <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em] italic">Brak dokumentów w Twoim dossier</p>
                                </div>
                            )}
                         </div>
                      </div>
                   </div>
                   <div className="lg:col-span-4">
                      <DocumentUpload onUpload={handleDocUpload} />
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'admin' && (
             <div className="animate-in slide-in-from-right-12 duration-700 space-y-12">
                <header className="flex justify-between items-end">
                   <div>
                      <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Instruktorzy</h1>
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-4">Nadzór nad uprawnieniami DTO</p>
                   </div>
                   <div className="bg-white px-8 py-5 rounded-[2rem] border border-slate-100 shadow-xl flex items-center space-x-4">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-900 uppercase">Google Calendar</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Auto-Sync ready</p>
                      </div>
                   </div>
                </header>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                   <div className="lg:col-span-4">
                      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
                         <h3 className="font-black text-slate-900 uppercase text-xs mb-8 tracking-widest italic">Zaproś pilota</h3>
                         <form onSubmit={handleInvite} className="space-y-4">
                            <input type="email" required placeholder="Adres email Google" className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-sm focus:border-blue-500 transition-colors" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                            <button className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all">Wyślij Zaproszenie</button>
                         </form>
                      </div>
                   </div>
                   <div className="lg:col-span-8">
                      <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
                         <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                               <tr><th className="p-10">Instruktor</th><th className="p-10">Status</th><th className="p-10 text-right">Zarządzaj</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                               {allInstructors.map(inst => (
                                  <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                                     <td className="p-10">
                                        <div className="flex items-center space-x-6">
                                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black italic shadow-lg">{inst.fullName.charAt(0)}</div>
                                            <div>
                                                <p className="font-black uppercase italic text-xs text-slate-900">{inst.fullName}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{inst.email}</p>
                                            </div>
                                        </div>
                                     </td>
                                     <td className="p-10">
                                        <span className="px-5 py-2.5 bg-green-100 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest">Weryfikacja OK</span>
                                     </td>
                                     <td className="p-10 text-right">
                                        <button onClick={() => setViewingInstructor(inst)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[9px] font-black uppercase italic tracking-widest hover:bg-blue-600 transition-all shadow-lg">Otwórz dossier</button>
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
              <div className="space-y-10 animate-in zoom-in-95 duration-500">
                  <button onClick={() => setViewingInstructor(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center hover:text-slate-900 transition-colors group">
                    <i className="fas fa-arrow-left mr-4 group-hover:-translate-x-2 transition-transform"></i> 
                    Powrót do listy personelu
                  </button>
                  <div className="bg-white p-14 rounded-[4rem] shadow-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-14">
                          <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">{viewingInstructor.fullName}</h2>
                          <div className="flex space-x-3">
                              <span className="bg-slate-100 text-slate-500 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest">ID: {viewingInstructor.id}</span>
                          </div>
                      </div>
                      <div className="space-y-6">
                          {viewingInstructor.documents.filter(d => !d.isArchived).map(doc => (
                              <div key={doc.id} className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-2xl transition-all">
                                  <div className="flex items-center space-x-8">
                                      <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 shadow-sm transition-colors"><i className="fas fa-shield-halved text-2xl"></i></div>
                                      <div>
                                          <p className="font-black text-slate-900 uppercase italic text-sm tracking-tight">{doc.name}</p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Termin ważności: <span className="text-slate-900">{doc.expiryDate || 'BEZTERMINOWO'}</span></p>
                                      </div>
                                  </div>
                                  <div className="flex items-center space-x-6">
                                      {doc.expiryDate && (
                                          <button 
                                            disabled={isSyncing}
                                            onClick={() => handleGoogleCalendarSync(doc, viewingInstructor.fullName)} 
                                            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isSyncing ? 'bg-slate-200 text-slate-400' : 'bg-white text-blue-600 hover:bg-blue-600 hover:text-white'}`} 
                                            title="Ustaw alarm w kalendarzu"
                                          >
                                            <i className={`fas ${isSyncing ? 'fa-spinner fa-spin' : 'fa-calendar-check'} text-lg`}></i>
                                          </button>
                                      )}
                                      <a href={doc.attachments[0]?.fileUrl} target="_blank" className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-blue-600 transition-all"><i className="fas fa-expand text-lg"></i></a>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
