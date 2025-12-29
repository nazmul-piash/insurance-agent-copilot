
import React, { useState } from 'react';

export const SetupGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud' | 'ide'>('local');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
        <div className="bg-indigo-900 text-white px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">System Installation Guide</h2>
            <p className="text-indigo-300 text-sm">Deployment & Configuration Steps</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-indigo-800 rounded-full transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 mx-8 mt-6 rounded-xl">
          <button onClick={() => setActiveTab('local')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'local' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>LOCAL PC</button>
          <button onClick={() => setActiveTab('ide')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'ide' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>STACKBLITZ / CLOUD IDE</button>
          <button onClick={() => setActiveTab('cloud')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${activeTab === 'cloud' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>SUPABASE CLOUD DB</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-8 custom-scrollbar">
          {activeTab === 'local' && (
            <section className="animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-4">Phase 1: Local Terminal Setup</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2">1. Set API Key Environment Variable</p>
                  <p className="text-xs text-slate-500 mb-2">Paste this command into your terminal to use your key:</p>
                  <code className="bg-slate-900 text-indigo-300 p-2 rounded block text-[11px] font-mono break-all">
                    export API_KEY="AIzaSyB8wvWcM1hekD7VctwdJnR-BPVO4eLgrGY"
                  </code>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2">2. Install & Run</p>
                  <code className="bg-slate-900 text-indigo-300 p-2 rounded block text-[11px] font-mono">
                    npm install -D vite && npx vite
                  </code>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'ide' && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-4">Phase 2: Configuration in StackBlitz</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-indigo-100 text-indigo-600 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">1</div>
                  <p className="text-sm text-slate-600">Open the <strong>Settings</strong> or <strong>Environment Variables</strong> tab in your Cloud IDE sidebar.</p>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-indigo-100 text-indigo-600 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">2</div>
                  <p className="text-sm text-slate-600">Add a New Variable:<br/><span className="font-mono text-xs bg-slate-100 px-1">Name: API_KEY</span><br/><span className="font-mono text-xs bg-slate-100 px-1 break-all">Value: AIzaSyB8wvWcM1hekD7VctwdJnR-BPVO4eLgrGY</span></p>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-indigo-100 text-indigo-600 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">3</div>
                  <p className="text-sm text-slate-600">Restart the dev server for the changes to take effect.</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'cloud' && (
            <section className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-4">Phase 3: Supabase Cloud Storage</h3>
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-emerald-900 mb-2">How to find your credentials:</p>
                  <ol className="text-xs text-emerald-800 space-y-2 list-decimal ml-4">
                    <li>Go to your project in the <strong>Supabase Dashboard</strong>.</li>
                    <li>Click the <strong>Settings (Gear icon ⚙️)</strong> at the bottom of the left sidebar.</li>
                    <li>Select <strong>API</strong> from the Settings menu.</li>
                    <li>Copy the <strong>Project URL</strong> and the <strong>anon public key</strong>.</li>
                  </ol>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-2">1. Prepare Database Table</p>
                  <p className="text-xs text-slate-500 mb-3">Click <strong>SQL Editor</strong> in Supabase and run this script:</p>
                  <code className="bg-slate-900 text-indigo-300 p-3 rounded block text-[11px] font-mono whitespace-pre overflow-x-auto">
{`create table client_memory (
  id uuid default gen_random_uuid() primary key,
  client_id text not null,
  summary text not null,
  date text not null,
  created_at timestamp with time zone default now()
);`}
                  </code>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-indigo-900 mb-1">2. Paste into App</p>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Open the **"Cloud Settings"** button in this app's top navigation bar and paste the credentials there.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-all active:scale-95">
            Got it, Setup Complete
          </button>
        </div>
      </div>
    </div>
  );
};
