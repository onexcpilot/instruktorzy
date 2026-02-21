import React from 'react';
import { User, ExpiryAlert } from '../types';
import { getInstructorAlerts, getAlertColor, getAlertLabel } from '../services/expiryChecker';

interface Props {
  user: User;
}

const ExpiryAlertBanner: React.FC<Props> = ({ user }) => {
  const alerts = getInstructorAlerts(user);

  if (alerts.length === 0) return null;

  const hasExpired = alerts.some(a => a.level === 'expired');
  const hasCritical = alerts.some(a => a.level === 'critical');

  const bannerBg = hasExpired ? 'bg-red-50 border-red-200' : hasCritical ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200';
  const bannerIcon = hasExpired ? 'fa-exclamation-circle text-red-500' : hasCritical ? 'fa-exclamation-triangle text-orange-500' : 'fa-clock text-amber-500';

  return (
    <div className={`${bannerBg} border rounded-[2rem] p-8 space-y-4`}>
      <div className="flex items-center gap-4">
        <i className={`fas ${bannerIcon} text-2xl`}></i>
        <div>
          <h3 className="font-black text-sm uppercase italic text-slate-900">
            {hasExpired
              ? 'Masz wygasle dokumenty!'
              : hasCritical
                ? 'Dokumenty wygasaja wkrotce!'
                : 'Przypomnienie o dokumentach'
            }
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">
            Zgodnie z Part-FCL, instruktor odpowiada za utrzymanie waznosci swoich uprawnien.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {alerts.map((alert, idx) => {
          const colors = getAlertColor(alert.level);
          return (
            <div key={idx} className={`flex items-center justify-between p-4 ${colors.bg} rounded-2xl border ${colors.border}`}>
              <div className="flex items-center gap-3">
                <span className={`inline-block px-3 py-1 rounded-lg text-[8px] font-black uppercase text-white ${colors.badge}`}>
                  {getAlertLabel(alert.level)}
                </span>
                <span className="text-xs font-bold text-slate-700">{alert.documentName}</span>
              </div>
              <div className="text-right">
                <p className={`text-xs font-black ${colors.text}`}>
                  {alert.daysRemaining <= 0
                    ? `Wygasl ${Math.abs(alert.daysRemaining)} dni temu`
                    : `${alert.daysRemaining} dni`
                  }
                </p>
                <p className="text-[9px] text-slate-400">Wazny do: {alert.expiryDate}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExpiryAlertBanner;
