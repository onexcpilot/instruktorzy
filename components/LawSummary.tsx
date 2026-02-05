
import React from 'react';
import { AVIATION_LAW_SUMMARY } from '../constants';

const LawSummary: React.FC = () => {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-8 shadow-sm">
      <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
        <i className="fas fa-balance-scale mr-3"></i>
        {AVIATION_LAW_SUMMARY.title}
      </h2>
      <div className="space-y-4 text-sm text-blue-800 leading-relaxed">
        {AVIATION_LAW_SUMMARY.sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="font-semibold text-blue-900">{section.title}</h3>
            <p>{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LawSummary;
