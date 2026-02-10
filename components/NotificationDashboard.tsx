import React, { useState, useMemo, useEffect } from 'react';
import { User, ExpiryAlert, NotificationLevel } from '../types';
import { scanAllExpiries, getAlertsSummary, getAlertColor, getAlertLabel } from '../services/expiryChecker';
import { apiSendNotifications, apiGetNotificationLog } from '../services/api';

interface Props {
  users: User[];
  onViewInstructor: (user: User) => void;
}

const NotificationDashboard: React.FC<Props> = ({ users, onViewInstructor }) => {
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [filterLevel, setFilterLevel] = useState<NotificationLevel | 'all'>('all');
  const [lastCheckDate, setLastCheckDate] = useState<string>('');

  const alerts = useMemo(() => scanAllExpiries(users), [users]);
  const summary = useMemo(() => getAlertsSummary(alerts), [alerts]);

  const filteredAlerts = filterLevel === 'all' ? alerts : alerts.filter(a => a.level === filterLevel);

  // Pobierz ostatnia date sprawdzenia z logu
  useEffect(() => {
    apiGetNotificationLog(1).then(logs => {
      if (logs.length > 0) {
        setLastCheckDate(logs[0].sent_at || logs[0].sentAt || '');
      }
    }).catch(() => {});
  }, []);

  const handleSendNotifications = async () => {
    if (!confirm('Czy na pewno chcesz wyslac powiadomienia email do instruktorow z wygasajacymi dokumentami?')) return;
    setIsSending(true);
    setSendResult(null);

    try {
      const result = await apiSendNotifications();
      setSendResult(result);
    } catch (err: any) {
      setSendResult({ error: err.message || 'Brak polaczenia z serwerem.' });
    }
    setIsSending(false);
  };

  const summaryCards: { level: NotificationLevel | 'all'; label: string; count: number; color: string; bgColor: string }[] = [
    { level: 'all', label: 'Wszystkie', count: summary.total, color: 'text-slate-700', bgColor: 'bg-slate-100' },
    { level: 'expired', label: 'Wygasle', count: summary.expired, color: 'text-red-700', bgColor: 'bg-red-50' },
    { level: 'critical', label: 'Krytyczne', count: summary.critical, color: 'text-orange-700', bgColor: 'bg-orange-50' },
    { level: 'warning', label: 'Ostrzezenia', count: summary.warning, color: 'text-amber-700', bgColor: 'bg-amber-50' },
    { level: 'info', label: 'Informacje', count: summary.info, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase italic text-slate-900">Powiadomienia</h2>
          <p className="text-xs text-slate-400 mt-1">
            {lastCheckDate
              ? `Ostatnie sprawdzenie: ${new Date(lastCheckDate).toLocaleString('pl-PL')}`
              : 'Brak historii powiadomien'}
          </p>
        </div>
        <button
          onClick={handleSendNotifications}
          disabled={isSending || alerts.length === 0}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${
            isSending || alerts.length === 0
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
          }`}
        >
          <i className={`fas ${isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          {isSending ? 'Wysylanie...' : 'Wyslij Powiadomienia'}
        </button>
      </div>

      {/* Send result */}
      {sendResult && (
        <div className={`p-6 rounded-2xl border ${sendResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {sendResult.error ? (
            <p className="text-red-700 text-xs font-bold">{sendResult.error}</p>
          ) : (
            <div>
              <p className="text-green-700 text-xs font-bold mb-2">
                Wysylka zakonczona. Alertow: {sendResult.totalAlerts || 0}.
              </p>
              {sendResult.results?.map((r: any, i: number) => (
                <p key={i} className={`text-[10px] ${r.sent ? 'text-green-600' : r.skipped ? 'text-slate-500' : 'text-red-600'}`}>
                  {r.email}: {r.sent ? 'Wyslano' : r.skipped ? 'Pominiety (juz wysylano dzisiaj)' : `Blad: ${r.error}`}
                </p>
              ))}
            </div>
          )}
          <button onClick={() => setSendResult(null)} className="mt-3 text-[9px] font-bold text-slate-400 uppercase">Zamknij</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {summaryCards.map(card => (
          <button
            key={card.level}
            onClick={() => setFilterLevel(card.level)}
            className={`p-5 rounded-2xl border transition-all text-center ${
              filterLevel === card.level
                ? `${card.bgColor} border-current ring-2 ring-current/20`
                : 'bg-white border-slate-100 hover:border-slate-200'
            }`}
          >
            <p className={`text-3xl font-black ${card.color}`}>{card.count}</p>
            <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filterLevel === card.level ? card.color : 'text-slate-400'}`}>
              {card.label}
            </p>
          </button>
        ))}
      </div>

      {/* Alerts Table */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 text-center">
          <i className="fas fa-check-circle text-4xl text-green-400 mb-4"></i>
          <p className="font-black text-sm uppercase italic text-slate-400">
            {alerts.length === 0 ? 'Brak alertow - wszystkie dokumenty wazne' : 'Brak alertow w tej kategorii'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-[10px] font-black uppercase text-slate-400">
                  <th className="p-6">Status</th>
                  <th className="p-6">Instruktor</th>
                  <th className="p-6">Dokument</th>
                  <th className="p-6">Wazny do</th>
                  <th className="p-6">Pozostalo</th>
                  <th className="p-6 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredAlerts.map((alert, idx) => {
                  const colors = getAlertColor(alert.level);
                  const instructor = users.find(u => u.id === alert.instructorId);
                  return (
                    <tr key={`${alert.instructorId}-${alert.documentId}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-6">
                        <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase text-white ${colors.badge}`}>
                          {getAlertLabel(alert.level)}
                        </span>
                      </td>
                      <td className="p-6">
                        <p className="font-black text-xs uppercase italic">{alert.instructorName}</p>
                        <p className="text-[10px] text-slate-400">{alert.instructorEmail}</p>
                      </td>
                      <td className="p-6">
                        <p className="text-xs font-bold">{alert.documentName}</p>
                      </td>
                      <td className="p-6">
                        <p className="text-xs font-mono">{alert.expiryDate}</p>
                      </td>
                      <td className="p-6">
                        <p className={`text-xs font-black ${colors.text}`}>
                          {alert.daysRemaining <= 0
                            ? `${Math.abs(alert.daysRemaining)} dni po terminie`
                            : `${alert.daysRemaining} dni`
                          }
                        </p>
                      </td>
                      <td className="p-6 text-right">
                        {instructor && (
                          <button
                            onClick={() => onViewInstructor(instructor)}
                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                          >
                            Akta
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDashboard;
