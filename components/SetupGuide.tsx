
import React, { useState } from 'react';

export const SetupGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'cloud'>('setup');

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-900 text-white px-10 py-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">System Configuration</h2>
            <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mt-1">Version 4.2 Deployment Guide</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-800 rounded-full transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex bg-slate-100 p-1.5 mx-10 mt-8 rounded-[20px]">
          <button onClick={() => setActiveTab('setup')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all ${activeTab === 'setup' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>GENERAL SETUP</button>
          <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-3 text-[10px] font-black rounded-2xl transition-all ${activeTab === 'cloud' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>SQL DATABASE SYNC</button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 pt-6 space-y-8">
          {activeTab === 'setup' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">API Key Authentication</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  When starting the app, you will see a fullscreen prompt to select your API key. This key is used to power the Gemini 3 Flash synthesis model.
                </p>
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Playbook Configuration</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Open the "Playbook" in the top bar to paste custom agent rules or upload a PDF handbook. This information is combined with the client history to generate precise replies.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl">
                <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3">Step 1: SQL Initialization</h4>
                <p className="text-sm text-emerald-900 mb-4 font-medium">Run this script in your Supabase SQL Editor to enable shared memory:</p>
                <code className="bg-slate-900 text-indigo-300 p-5 rounded-2xl block text-[11px] font-mono whitespace-pre overflow-x-auto shadow-xl">
{`create table client_memory (
  id uuid default gen_random_uuid() primary key,
  client_id text not null,
  summary text not null,
  date text not null,
  policy_number text,
  created_at timestamp with time zone default now()
);`}
                </code>
              </div>
              <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Step 2: App Connection</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Go to "Connect Cloud" in the top bar and paste your Supabase URL and Anon Key. Toggle "Cloud On" to start syncing memory to your SQL database.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-10 py-6 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-10 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
            Exit Guide
          </button>
        </div>
      </div>
    </div>
  );
};
