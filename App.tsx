
import React, { useState, useEffect } from 'react';
import { User, UserRole, DocumentRecord } from './types';
import { findUserByEmail, getDb, saveDb, createInvitation, updateUser } from './services/mockDb';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin' | 'settings'>('dashboard');
  const [inviteEmail, setInviteEmail] = useState('');
  const [viewingInstructor, setViewingInstructor] = useState<User | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  
  // Password change states
  const [newPass, setNewPass] = useState('');
  const [adminChangePass, setAdminChangePass] = useState<{userId: string, pass: string} | null>(null);

  useEffect(() => {
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
          alert(`Brak uprawnień dla ${userEmail}. Poproś o zaproszenie.`);
          return;
        }
        setCurrentUser(user);
      } catch (e) { console.error(e); }
    };

    const initGoogle = () => {
      if (window.google && clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false
        });
        const btnContainer = document.getElementById("google_login_btn");
        if (btnContainer) {
          window.google.accounts.id.renderButton(btnContainer, { theme: "outline", size: "large", width: "320" });
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

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = findUserByEmail(loginEmail);
    if (user && user.password === loginPass) {
      setCurrentUser(user);
    } else {
      alert("Błędny e-mail lub hasło.");
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) {
      alert("Hasło musi mieć min. 6 znaków.");
      return;
    }
    if (currentUser) {
      const updated = { ...currentUser, password: newPass };
      updateUser(updated);
      setCurrentUser(updated);
      setNewPass('');
      alert("Hasło zostało zmienione.");
    }
  };

  const handleAdminResetPass = (userId: string) => {
    if (!adminChangePass || adminChangePass.pass.length < 6) {
        alert("Wpisz min. 6 znaków hasła.");
        return;
    }
    const db = getDb();
    const user = db.users.find(u => u.id === userId);
    if (user) {
        user.password = adminChangePass.pass;
        saveDb(db);
        alert(`Hasło dla ${user.fullName} zostało zaktualizowane.`);
        setAdminChangePass(null);
        // Refresh local viewing instructor if it's the same
        if (viewingInstructor?.id === userId) setViewingInstructor({...user});
    }
  };

  const handleGoogleCalendarSync = (doc: DocumentRecord, instructorName: string) => {
    if (!tokenClient) return alert("Google API niegotowe.");
    tokenClient.callback = async (resp: any) => {
      if (resp.error) return;
      const event = {
        'summary': `ALARM DTO: Wygasa ${doc.name} - ${instructorName}`,
        'start': { 'date': doc.expiryDate },
        'end': { 'date': doc.expiryDate },
        'reminders': { 'useDefault': false, 'overrides': [{ 'method': 'email', 'minutes': 10080 }] }
      };
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resp.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      if (response.ok) alert("TERMIN DODANY!");
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    createInvitation(inviteEmail);
    const db = getDb();
    if (!db.users.find(u => u.email === inviteEmail)) {
        db.users.push({
            id: Math.random().toString(36).substring(7),
            email: inviteEmail,
            password: 'sierra', // Domyślne hasło dla nowych
            fullName: 'Oczekujący Instruktor',
            role: UserRole.INSTRUCTOR,
            documents: [],
            isInvited: true
        });
        saveDb(db);
    }
    setInviteEmail('');
    alert(`Zaproszenie wysłane. Domyślne hasło: sierra`);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-lg border-t-8 border-blue-600 text-center">
          <img src={LOGO_URL} alt="Sierra Zulu" className="h-20 mx-auto mb-6" />
          <h1 className="text-2xl font-black uppercase italic mb-8">Sierra Zulu Portal</h1>
          
          <div className="space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-3">
               <input type="email" placeholder="E-mail (login)" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-500" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
               <input type="password" placeholder="Hasło" required className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-blue-500" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
               <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-slate-800 transition-all">Zaloguj</button>
            </form>

            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase">lub</span>
                <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="flex justify-center">
                <div id="google_login_btn"></div>
            </div>
          </div>

          <p className="mt-8 text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            Administrator: onexcpilot@gmail.com<br/>Hasło startowe: sierra
          </p>
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
          <button onClick={() => {setActiveTab('dashboard'); setViewingInstructor(null);}} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' && !viewingInstructor ? 'bg-blue-600' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-user-pilot"></i><span className="font-black text-xs uppercase italic">Mój Profil</span>
          </button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'admin' ? 'bg-blue-600' : 'text-slate-500 hover:text-white'}`}>
              <i className="fas fa-tower-control"></i><span className="font-black text-xs uppercase italic">Instruktorzy</span>
            </button>
          )}
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-5 px-6 py-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-blue-600' : 'text-slate-500 hover:text-white'}`}>
            <i className="fas fa-shield-alt"></i><span className="font-black text-xs uppercase italic">Bezpieczeństwo</span>
          </button>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-800">
          <p className="text-[10px] font-black uppercase italic text-blue-400">{currentUser.fullName}</p>
          <button onClick={() => setCurrentUser(null)} className="mt-4 text-[9px] font-black text-red-400 uppercase tracking-widest hover:text-red-300">Wyloguj się</button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-14 overflow-y-auto">
        {activeTab === 'dashboard' && !viewingInstructor && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header><h1 className="text-4xl font-black text-slate-900 uppercase italic">Dokumentacja</h1></header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-8 space-y-8">
                <LawSummary />
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-4">
                   {currentUser.documents.filter(d => !d.isArchived).map(doc => (
                     <div key={doc.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-slate-100">
                       <div>
                            <p className="font-black text-xs uppercase italic">{doc.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">Ważność: {doc.expiryDate || 'BEZTERMINOWO'}</p>
                       </div>
                       <a href={doc.attachments[0]?.fileUrl} target="_blank" className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><i className="fas fa-eye"></i></a>
                     </div>
                   ))}
                   {currentUser.documents.length === 0 && <p className="text-center text-slate-400 text-xs py-10 font-bold uppercase tracking-widest">Brak przesłanych dokumentów</p>}
                </div>
              </div>
              <div className="lg:col-span-4"><DocumentUpload onUpload={handleDocUpload} /></div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-5xl mx-auto space-y-12">
            <header className="flex justify-between items-center">
              <h1 className="text-4xl font-black text-slate-900 uppercase italic">Baza Pilotów</h1>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
               <div className="lg:col-span-4">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                    <h3 className="font-black text-xs uppercase mb-6 italic">Dodaj instruktora</h3>
                    <form onSubmit={handleInvite} className="space-y-4">
                      <input type="email" required placeholder="E-mail" className="w-full p-4 bg-slate-50 rounded-xl border-none outline-none text-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                      <button className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100">Wyślij Zaproszenie</button>
                    </form>
                  </div>
               </div>
               <div className="lg:col-span-8">
                  <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100">
                    <table className="w-full">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr className="text-left"><th className="p-8">Instruktor</th><th className="p-8 text-right">Zarządzanie</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {allInstructors.map(inst => (
                          <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-8">
                                <p className="font-black text-xs uppercase italic">{inst.fullName}</p>
                                <p className="text-[10px] text-slate-400">{inst.email}</p>
                            </td>
                            <td className="p-8 text-right flex justify-end space-x-2">
                                <button onClick={() => setViewingInstructor(inst)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest">Akta</button>
                                <button onClick={() => setAdminChangePass({userId: inst.id, pass: ''})} className="bg-blue-50 text-blue-600 px-5 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest">Hasło</button>
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
          <div className="max-w-xl mx-auto space-y-8">
            <h1 className="text-4xl font-black text-slate-900 uppercase italic">Bezpieczeństwo</h1>
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100">
                <h2 className="font-black text-xs uppercase mb-6 italic">Zmień moje hasło</h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <input type="password" required placeholder="Nowe hasło (min. 6 znaków)" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none" value={newPass} onChange={e => setNewPass(e.target.value)} />
                    <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl uppercase text-[10px] tracking-widest">Zaktualizuj profil</button>
                </form>
            </div>
          </div>
        )}

        {viewingInstructor && (
          <div className="max-w-4xl mx-auto space-y-8">
            <button onClick={() => setViewingInstructor(null)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900"><i className="fas fa-arrow-left mr-2"></i> Powrót do listy</button>
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

        {/* Modal zmiany hasła przez Admina */}
        {adminChangePass && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md">
                    <h3 className="text-xl font-black uppercase italic mb-6">Ustaw nowe hasło</h3>
                    <input 
                        type="text" 
                        placeholder="Nowe hasło" 
                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none mb-6"
                        value={adminChangePass.pass}
                        onChange={e => setAdminChangePass({...adminChangePass, pass: e.target.value})}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setAdminChangePass(null)} className="py-4 text-[10px] font-black uppercase text-slate-400">Anuluj</button>
                        <button onClick={() => handleAdminResetPass(adminChangePass.userId)} className="bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest">Zapisz hasło</button>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
