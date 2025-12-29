
import React from 'react';
import { InteractionSummary } from '../types';

interface HistoryViewProps {
  history: InteractionSummary[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full max-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Client Memory</h3>
        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-full">
          {history.length} THREADS
        </span>
      </div>
      
      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
          <svg className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <p className="text-[10px] uppercase font-bold">No history for this ID</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {history.map((item, idx) => (
            <div key={idx} className="group cursor-default border-b border-slate-50 pb-4 last:border-0">
              <div className="flex justify-between items-start mb-1">
                <div className="text-[10px] font-black text-indigo-500 flex items-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                  {item.date}
                </div>
                {item.policyNumber && (
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">
                    POL: {item.policyNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-normal pl-3.5 border-l border-slate-100 group-hover:border-indigo-200 transition-colors">
                {item.summary.length > 120 ? item.summary.substring(0, 120) + '...' : item.summary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
