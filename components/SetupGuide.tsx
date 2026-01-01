
import React, { useState } from 'react';

export const SetupGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'ide'>('local');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
        <div className="bg-indigo-900 text-white px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">System Installation Guide</h2>
            <p className="text-indigo-300 text-sm tracking-wide">Secure Deployment & Configuration</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-800 rounded-full transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex bg-slate-100 p-1 mx-8 mt-6 rounded-xl">
          <button onClick={() => setActiveTab('local')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'local' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>LOCAL PC</button>
          <button onClick={() => setActiveTab('ide')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'ide' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>CLOUD IDE</button>
          <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'cloud' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>SUPABASE STORAGE</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-8 custom-scrollbar">
          {activeTab === 'local' && (
            <section className="animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-4">Phase 1: Local Environment Setup</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2">1. Set API Key Variable</p>
                  <p className="text-xs text-slate-500 mb-2">Create a <code className="bg-slate-200 px-1 font-mono">.env</code> file in your project root or set it in your shell:</p>
                  <code className="bg-slate-900 text-indigo-300 p-2 rounded block text-[11px] font-mono break-all">
                    export API_KEY="YOUR_GEMINI_API_KEY"
                  </code>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2">2. Install & Launch</p>
                  <code className="bg-slate-900 text-indigo-300 p-2 rounded block text-[11px] font-mono">
                    npm install && npm run dev
                  </code>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'ide' && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-4">Phase 2: IDE Configuration</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-indigo-100 text-indigo-600 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">1</div>
                  <p className="text-sm text-slate-600">Open <strong>Environment Variables</strong> in your IDE settings.</p>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-indigo-100 text-indigo-600 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">2</div>
                  <p className="text-sm text-slate-600">Add a variable named <code className="bg-slate-100 px-1 font-mono">API_KEY</code> and paste your key there.</p>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-indigo-100 text-indigo-600 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">3</div>
                  <p className="text-sm text-slate-600">Restart the process to inject the variable.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'cloud' && (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-4">Phase 3: Shared Team Memory</h3>
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-inner">
                  <p className="text-sm font-bold text-emerald-900 mb-2">Prerequisites:</p>
                  <ul className="text-xs text-emerald-800 space-y-2 list-disc ml-4 font-medium">
                    <li>Create a new Supabase project.</li>
                    <li>Copy your **Project URL** and **Anon Key**.</li>
                    <li>Use the Cloud Settings button in the navbar to connect.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2">1. SQL Initialization Script</p>
                  <code className="bg-slate-900 text-indigo-300 p-3 rounded block text-[11px] font-mono whitespace-pre overflow-x-auto shadow-lg">
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
              </div>
            </section>
          )}
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all active:scale-95">
            Dismiss Guide
          </button>
        </div>
      </div>
    </div>
  );
};
