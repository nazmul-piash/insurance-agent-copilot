
import React, { useState, useEffect, useRef } from 'react';
import { generateInsuranceReply } from './services/geminiService';
import { HistoryView } from './components/HistoryView';
import { SetupGuide } from './components/SetupGuide';
import { InteractionSummary, AnalysisState, CloudSettings } from './types';

const DEFAULT_PLAYBOOK = `[RULE: ADDRESS CHANGE]
- Ask for "Effective Date" of the move.
- Verify policies: Householders, Liability, Legal.
- Ask if bank details (IBAN) changed.

[RULE: STYLE]
- Professional and warm.
- Sign off: "Best regards, Your ARAG Team"`;

export const App: React.FC = () => {
  const [clientId, setClientId] = useState('');
  const [inputMode, setInputMode] = useState<'image' | 'text'>('image');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailText, setEmailText] = useState('');
  const [clientHistory, setClientHistory] = useState<InteractionSummary[]>([]);
  const [playbook, setPlaybook] = useState(DEFAULT_PLAYBOOK);
  const [playbookPdf, setPlaybookPdf] = useState<string | null>(null);
  const [playbookPdfName, setPlaybookPdfName] = useState<string | null>(null);
  
  const [isTrainingOpen, setIsTrainingOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCloudSettingsOpen, setIsCloudSettingsOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<'en' | 'de'>('en');
  
  const [hasApiKey, setHasApiKey] = useState(true);
  
  const [cloudSettings, setCloudSettings] = useState<CloudSettings>(() => {
    const saved = localStorage.getItem('arag_cloud_settings_v4');
    return saved ? JSON.parse(saved) : { supabaseUrl: '', supabaseKey: '', enabled: false };
  });

  const [state, setState] = useState<AnalysisState>({
    loading: false,
    error: null,
    result: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // API Key Check
  useEffect(() => {
    const checkKey = async () => {
      const aiStudio = (window as any).aistudio;
      if (typeof aiStudio !== 'undefined' && !process.env.API_KEY) {
        const selected = await aiStudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  // Playbook persistence
  useEffect(() => {
    const savedPlaybook = localStorage.getItem('arag_playbook_v4');
    if (savedPlaybook) setPlaybook(savedPlaybook);
  }, []);

  // History Sync Logic (Cloud or Local)
  useEffect(() => {
    const syncHistory = async () => {
      if (!clientId.trim()) {
        setClientHistory([]);
        return;
      }

      if (cloudSettings.enabled && cloudSettings.supabaseUrl && cloudSettings.supabaseKey) {
        try {
          const response = await fetch(`${cloudSettings.supabaseUrl}/rest/v1/client_memory?client_id=eq.${encodeURIComponent(clientId.trim())}&select=*&order=created_at.desc`, {
            headers: {
              'apikey': cloudSettings.supabaseKey,
              'Authorization': `Bearer ${cloudSettings.supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const data = await response.json();
            setClientHistory(data.map((item: any) => ({
              date: item.date,
              summary: item.summary,
              policyNumber: item.policy_number
            })));
          }
        } catch (e) {
          console.error("Cloud fetch failed:", e);
        }
      } else {
        const key = `arag_memory_v4_${clientId.trim().toLowerCase()}`;
        const stored = localStorage.getItem(key);
        setClientHistory(stored ? JSON.parse(stored) : []);
      }
    };
    syncHistory();
  }, [clientId, cloudSettings]);

  const handleOpenSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (typeof aiStudio !== 'undefined') {
      await aiStudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPlaybookPdfName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setPlaybookPdf(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    setState({ loading: true, error: null, result: null });
    try {
      const res = await generateInsuranceReply(
        { 
          image: inputMode === 'image' ? previewUrl || undefined : undefined, 
          text: inputMode === 'text' ? emailText : undefined 
        },
        clientId,
        clientHistory,
        playbook,
        playbookPdf || undefined
      );

      setState({ loading: false, error: null, result: res });

      if (res.analysis) {
        const newHistoryItem: InteractionSummary = {
          date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          summary: res.analysis,
          policyNumber: res.extractedPolicyNumber || undefined,
        };

        // Save to Cloud if enabled
        if (cloudSettings.enabled && cloudSettings.supabaseUrl && cloudSettings.supabaseKey) {
          await fetch(`${cloudSettings.supabaseUrl}/rest/v1/client_memory`, {
            method: 'POST',
            headers: {
              'apikey': cloudSettings.supabaseKey,
              'Authorization': `Bearer ${cloudSettings.supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              client_id: clientId.trim() || 'anonymous',
              summary: res.analysis,
              date: newHistoryItem.date,
              policy_number: res.extractedPolicyNumber || null
            })
          });
          // Refresh history from cloud
          setClientId(prev => prev); 
        } else {
          // Save Local
          const updatedHistory = [newHistoryItem, ...clientHistory].slice(0, 10);
          setClientHistory(updatedHistory);
          const key = `arag_memory_v4_${clientId.trim().toLowerCase() || 'anonymous'}`;
          localStorage.setItem(key, JSON.stringify(updatedHistory));
        }
      }
    } catch (err: any) {
      if (err.message === "KEY_RESET_REQUIRED") {
        setHasApiKey(false);
      }
      setState({ loading: false, error: err.message, result: null });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {!hasApiKey && (
        <div className="fixed inset-0 z-[200] bg-indigo-950 flex flex-col items-center justify-center p-8 text-center text-white">
          <div className="bg-yellow-400 text-indigo-900 p-2 rounded mb-6 font-black text-xs uppercase tracking-widest">Setup Required</div>
          <h2 className="text-3xl font-black mb-4 tracking-tight">API Key Selection</h2>
          <p className="max-w-md text-indigo-200 text-sm mb-10 leading-relaxed">
            Please select an API key to enable InsurBot intelligence features.
          </p>
          <button onClick={handleOpenSelectKey} className="px-12 py-4 bg-white text-indigo-900 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all">SELECT API KEY</button>
        </div>
      )}

      <nav className="bg-indigo-900 text-white border-b border-indigo-800 sticky top-0 z-50 px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-400 p-1.5 rounded text-indigo-900 font-black text-[10px]">ARAG</div>
            <h1 className="font-black text-lg tracking-tight">InsurBot <span className="text-indigo-400 font-normal">v4.2</span></h1>
          </div>
          <div className="flex space-x-4">
            <button onClick={() => setIsSetupOpen(true)} className="text-xs font-bold text-indigo-300 hover:text-white transition-colors">Guide</button>
            <button onClick={() => setIsCloudSettingsOpen(true)} className={`text-xs font-bold px-3 py-1 rounded transition-colors ${cloudSettings.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'text-indigo-300 hover:text-white'}`}>
              {cloudSettings.enabled ? 'Cloud On' : 'Connect Cloud'}
            </button>
            <button onClick={() => setIsTrainingOpen(true)} className="bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/10">Playbook</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-8">
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8">
            <div className="mb-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Client</label>
              <input 
                type="text" 
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="ID or Client Name..." 
                className="w-full bg-slate-50 rounded-2xl px-5 py-3 text-sm border-transparent outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              />
            </div>
            
            <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-6">
              <button onClick={() => setInputMode('image')} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${inputMode === 'image' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>SCREENSHOT</button>
              <button onClick={() => setInputMode('text')} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${inputMode === 'text' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>TEXT CONTENT</button>
            </div>

            {inputMode === 'image' ? (
              <div 
                onClick={() => fileInputRef.current?.click()} 
                className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-400 transition-all"
              >
                {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <div className="text-center p-4 text-[10px] font-black text-slate-400 uppercase">Upload Screenshot</div>}
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setPreviewUrl(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }} accept="image/*" />
              </div>
            ) : (
              <textarea 
                value={emailText} 
                onChange={(e) => setEmailText(e.target.value)} 
                placeholder="Paste email text here..."
                className="w-full h-48 bg-slate-50 rounded-[24px] p-6 text-sm border-transparent focus:ring-4 focus:ring-indigo-50 outline-none resize-none shadow-inner" 
              />
            )}

            <button onClick={handleProcess} disabled={state.loading} className={`w-full mt-6 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center space-x-3 ${state.loading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              {state.loading ? 'SYNTHESIZING...' : 'PROCESS CASE'}
            </button>
            <button onClick={() => { setClientId(''); setPreviewUrl(null); setEmailText(''); setState({loading: false, error: null, result: null}); }} className="w-full mt-4 text-[10px] text-slate-400 font-bold uppercase hover:text-slate-600 transition-colors">Clear Workspace</button>
          </div>
          <HistoryView history={clientHistory} />
        </aside>

        <section className="col-span-12 lg:col-span-8 space-y-6">
          {state.error && <div className="p-5 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-xs font-black uppercase tracking-widest">{state.error}</div>}
          
          {state.result ? (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
              <div className="bg-indigo-900 text-white p-8 rounded-[40px] shadow-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Detected Profile</p>
                  <p className="text-xl font-bold">{state.result.extractedClientName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Policy Number</p>
                  <p className="text-xl font-bold text-yellow-400">{state.result.extractedPolicyNumber || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-10 rounded-[40px] border border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Analysis</h4>
                  <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-indigo-600 pl-6">{state.result.analysis}</p>
                </div>
                <div className="bg-white p-10 rounded-[40px] border border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recommendation</h4>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{state.result.recommendation}</p>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden border-b-8 border-indigo-900">
                <div className="flex bg-indigo-950 text-white p-2">
                  <button onClick={() => setActiveLang('en')} className={`flex-1 py-4 rounded-3xl text-[10px] font-black transition-all ${activeLang === 'en' ? 'bg-indigo-600' : 'text-indigo-400'}`}>ENGLISH DRAFT</button>
                  <button onClick={() => setActiveLang('de')} className={`flex-1 py-4 rounded-3xl text-[10px] font-black transition-all ${activeLang === 'de' ? 'bg-indigo-600' : 'text-indigo-400'}`}>GERMAN DRAFT</button>
                </div>
                <div className="p-10">
                  <div className="bg-slate-50 p-10 rounded-3xl border border-slate-100 font-mono text-[13px] text-slate-800 whitespace-pre-wrap leading-loose shadow-inner min-h-[400px]">
                    {activeLang === 'en' ? state.result.replyEnglish : state.result.replyGerman}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(activeLang === 'en' ? state.result!.replyEnglish : state.result!.replyGerman); alert("Copied!"); }} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Copy Content</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[600px] bg-white border border-slate-200 rounded-[40px] flex flex-col items-center justify-center text-slate-300 p-12 text-center">
              <svg className="h-16 w-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <h3 className="text-xl font-black text-slate-400 mb-2 tracking-tight uppercase">Ready for Analysis</h3>
              <p className="max-w-xs text-sm font-medium">Input a case on the left to begin synthesis.</p>
            </div>
          )}
        </section>
      </main>

      {isSetupOpen && <SetupGuide onClose={() => setIsSetupOpen(false)} />}
      
      {isTrainingOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="bg-indigo-900 p-10 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black tracking-tighter uppercase">Agent Playbook</h3>
                <p className="text-indigo-300 text-xs font-bold tracking-widest uppercase mt-1">Logic & Handbook</p>
              </div>
              <button onClick={() => setIsTrainingOpen(false)} className="p-4 hover:bg-white/10 rounded-full transition-all">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custom Rules (Text)</label>
                <textarea 
                  value={playbook} 
                  onChange={(e) => setPlaybook(e.target.value)} 
                  className="w-full h-80 bg-slate-50 rounded-[32px] p-8 text-xs font-mono border-transparent focus:ring-4 focus:ring-indigo-50 outline-none resize-none shadow-inner" 
                />
              </div>
              <div className="space-y-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Policy Handbook (PDF)</label>
                <div className={`h-80 border-2 border-dashed rounded-[32px] flex flex-col items-center justify-center transition-all ${playbookPdf ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-400'}`}>
                  {playbookPdf ? (
                    <div className="text-center p-8">
                      <p className="text-sm font-black text-indigo-950 mb-4">{playbookPdfName}</p>
                      <button onClick={() => {setPlaybookPdf(null); setPlaybookPdfName(null);}} className="text-[10px] font-black text-red-500 uppercase">Remove</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer group">
                      <svg className="h-10 w-10 text-indigo-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Upload Handbook</p>
                      <input type="file" ref={pdfInputRef} className="hidden" accept=".pdf" onChange={handlePdfUpload} />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="p-10 bg-slate-50 border-t flex justify-end">
              <button onClick={() => { localStorage.setItem('arag_playbook_v4', playbook); setIsTrainingOpen(false); }} className="px-16 py-5 bg-indigo-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {isCloudSettingsOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[40px] shadow-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="bg-indigo-900 p-8 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tight">Cloud Sync Settings</h3>
              <button onClick={() => setIsCloudSettingsOpen(false)} className="text-white hover:opacity-70 transition-opacity">
                 <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="flex items-center justify-between bg-slate-50 p-6 rounded-3xl">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                  <p className="font-bold">{cloudSettings.enabled ? 'SQL SYNC ACTIVE' : 'LOCAL ONLY'}</p>
                </div>
                <button onClick={() => setCloudSettings({...cloudSettings, enabled: !cloudSettings.enabled})} className={`w-14 h-8 rounded-full transition-all relative p-1 ${cloudSettings.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-6 h-6 bg-white rounded-full transition-all shadow-md ${cloudSettings.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="space-y-4">
                <input type="text" value={cloudSettings.supabaseUrl} onChange={e => setCloudSettings({...cloudSettings, supabaseUrl: e.target.value})} placeholder="Supabase Project URL" className="w-full bg-slate-50 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-50 border-transparent outline-none transition-all" />
                <input type="password" value={cloudSettings.supabaseKey} onChange={e => setCloudSettings({...cloudSettings, supabaseKey: e.target.value})} placeholder="Supabase Anon Key" className="w-full bg-slate-50 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-50 border-transparent outline-none transition-all" />
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t flex justify-end">
              <button onClick={() => { localStorage.setItem('arag_cloud_settings_v4', JSON.stringify(cloudSettings)); setIsCloudSettingsOpen(false); }} className="px-10 py-3 bg-indigo-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">Save Configuration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
