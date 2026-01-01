
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

// The window.aistudio helper is assumed to be pre-configured and accessible in the environment.
// Redundant or conflicting declarations are removed to avoid TypeScript compilation errors.

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
    const saved = localStorage.getItem('arag_cloud_settings');
    return saved ? JSON.parse(saved) : { supabaseUrl: '', supabaseKey: '', enabled: false };
  });

  const [state, setState] = useState<AnalysisState>({
    loading: false,
    error: null,
    result: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial API Key check
  useEffect(() => {
    const checkKey = async () => {
      // Accessing aistudio via casting to any to satisfy TS while relying on environment availability
      if (typeof (window as any).aistudio !== 'undefined' && !process.env.API_KEY) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    const savedPlaybook = localStorage.getItem('arag_agent_playbook');
    if (savedPlaybook) setPlaybook(savedPlaybook);
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      if (!clientId.trim()) {
        setClientHistory([]);
        return;
      }

      if (cloudSettings.enabled && cloudSettings.supabaseUrl && cloudSettings.supabaseKey) {
        try {
          const response = await fetch(`${cloudSettings.supabaseUrl}/rest/v1/client_memory?client_id=eq.${encodeURIComponent(clientId.trim().toLowerCase())}&select=*&order=created_at.desc`, {
            headers: {
              'apikey': cloudSettings.supabaseKey,
              'Authorization': `Bearer ${cloudSettings.supabaseKey}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setClientHistory(data.map((item: any) => ({ 
              date: item.date, 
              summary: item.summary,
              policyNumber: item.policy_number 
            })));
            return;
          }
        } catch (e) {
          console.error("Cloud fetch failed:", e);
        }
      }

      const key = `arag_memory_v2_${clientId.trim().toLowerCase()}`;
      const stored = localStorage.getItem(key);
      setClientHistory(stored ? JSON.parse(stored) : []);
    };

    loadHistory();
  }, [clientId, cloudSettings]);

  const handleOpenSelectKey = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      await (window as any).aistudio.openSelectKey();
      // Assume success after triggering the dialog to mitigate potential race conditions
      setHasApiKey(true);
    }
  };

  const resetWorkspace = () => {
    setClientId('');
    setPreviewUrl(null);
    setEmailText('');
    setState({ loading: false, error: null, result: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Please upload a valid PDF file.");
        return;
      }
      setPlaybookPdfName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => setPlaybookPdf(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (inputMode === 'image' && !previewUrl) {
      setState(s => ({...s, error: "Please upload an email screenshot."}));
      return;
    }
    if (inputMode === 'text' && !emailText.trim()) {
      setState(s => ({...s, error: "Please paste the email text."}));
      return;
    }

    setState({ loading: true, error: null, result: null });

    try {
      const inputData = inputMode === 'image' ? { image: previewUrl! } : { text: emailText };
      const result = await generateInsuranceReply(
        inputData, 
        clientId, 
        clientHistory, 
        playbook, 
        playbookPdf || undefined
      );
      
      const finalClientId = clientId || result.extractedClientName;
      if (!clientId && result.extractedClientName) {
        setClientId(result.extractedClientName);
      }

      const newEntry: InteractionSummary = {
        date: new Date().toLocaleString(),
        summary: result.summary,
        policyNumber: result.extractedPolicyNumber || undefined,
      };

      if (cloudSettings.enabled && cloudSettings.supabaseUrl) {
        try {
          await fetch(`${cloudSettings.supabaseUrl}/rest/v1/client_memory`, {
            method: 'POST',
            headers: {
              'apikey': cloudSettings.supabaseKey,
              'Authorization': `Bearer ${cloudSettings.supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              client_id: finalClientId.trim().toLowerCase(),
              summary: newEntry.summary,
              date: newEntry.date,
              policy_number: newEntry.policyNumber
            })
          });
        } catch (e) {
          console.error("Cloud update failed.");
        }
      }

      const key = `arag_memory_v2_${finalClientId.trim().toLowerCase()}`;
      const existing = localStorage.getItem(key);
      const updatedHistory = [newEntry, ...(existing ? JSON.parse(existing) : [])];
      localStorage.setItem(key, JSON.stringify(updatedHistory));
      
      setClientHistory(updatedHistory);
      setState({ loading: false, error: null, result });
      setActiveLang('en');
    } catch (err: any) {
      if (err.message === "KEY_RESET_REQUIRED") {
        setHasApiKey(false);
        setState({ loading: false, error: "API Key reset required. Please select your key again.", result: null });
      } else {
        console.error("Analysis Error:", err);
        setState({ loading: false, error: err.message || "Analysis failed.", result: null });
      }
    }
  };

  const saveCloudSettings = (settings: CloudSettings) => {
    setCloudSettings(settings);
    localStorage.setItem('arag_cloud_settings', JSON.stringify(settings));
    setIsCloudSettingsOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100">
      {/* API Key Selection Screen */}
      {!hasApiKey && (
        <div className="fixed inset-0 z-[200] bg-indigo-950 flex flex-col items-center justify-center p-8 text-center text-white">
          <div className="bg-yellow-400 text-indigo-900 p-2 rounded mb-6 font-black text-xs uppercase tracking-widest">Setup Required</div>
          <h2 className="text-3xl font-black mb-4 tracking-tight">API Key Selection</h2>
          <p className="max-w-md text-indigo-200 text-sm mb-10 leading-relaxed font-medium">
            To use the Agent Copilot, you must select a paid Google Cloud Project API key. 
            <br />
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline text-yellow-400 hover:text-white transition-colors">Learn more about billing.</a>
          </p>
          <button 
            onClick={handleOpenSelectKey}
            className="px-12 py-4 bg-white text-indigo-900 rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all"
          >
            SELECT API KEY
          </button>
        </div>
      )}

      {isSetupOpen && <SetupGuide onClose={() => setIsSetupOpen(false)} />}
      
      {isCloudSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Cloud Configuration</h2>
            <div className="space-y-4 mt-6">
              <input 
                type="text" 
                placeholder="Supabase URL" 
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                value={cloudSettings.supabaseUrl}
                onChange={e => setCloudSettings({...cloudSettings, supabaseUrl: e.target.value})}
              />
              <input 
                type="password" 
                placeholder="Supabase Anon Key" 
                className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                value={cloudSettings.supabaseKey}
                onChange={e => setCloudSettings({...cloudSettings, supabaseKey: e.target.value})}
              />
              <label className="flex items-center space-x-3 cursor-pointer p-4 bg-slate-50 rounded-xl">
                <input 
                  type="checkbox" 
                  checked={cloudSettings.enabled} 
                  onChange={e => setCloudSettings({...cloudSettings, enabled: e.target.checked})}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-sm font-bold text-slate-700">Enable Cloud Storage</span>
              </label>
            </div>
            <div className="mt-8 flex space-x-3">
              <button onClick={() => setIsCloudSettingsOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">Cancel</button>
              <button onClick={() => saveCloudSettings(cloudSettings)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Playbook Overlay Modal */}
      {isTrainingOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white border border-indigo-100 rounded-[40px] w-full max-w-4xl p-10 shadow-3xl animate-in zoom-in-95 duration-300 relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-indigo-900 text-xl uppercase flex items-center tracking-tighter">
                  <svg className="h-6 w-6 mr-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Agent Intelligence Playbook
                </h3>
                <p className="text-slate-400 text-xs font-bold mt-1 tracking-wide">Configure AI decision-making logic & knowledge bases.</p>
              </div>
              <button onClick={() => setIsTrainingOpen(false)} className="bg-slate-50 text-slate-300 hover:text-slate-600 transition-colors p-3 rounded-full hover:bg-slate-100">
                 <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Policy Guide (PDF)</label>
                <div className={`relative border-2 border-dashed rounded-[32px] p-8 transition-all flex flex-col items-center justify-center h-56 ${playbookPdf ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-slate-100/50'}`}>
                  {playbookPdf ? (
                    <div className="text-center w-full">
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 inline-block mb-4">
                        <svg className="h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <p className="text-xs font-black text-indigo-950 truncate max-w-[240px] mx-auto mb-4">{playbookPdfName}</p>
                      <button 
                        onClick={() => {
                          setPlaybookPdf(null); 
                          setPlaybookPdfName(null);
                        }} 
                        className="text-[10px] text-white bg-red-500 px-6 py-2 rounded-xl font-black shadow-lg hover:bg-red-600 transition-colors uppercase tracking-widest"
                      >
                        REMOVE KNOWLEDGE BASE
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 group-hover:scale-110 transition-transform">
                        <svg className="h-8 w-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Click to Upload PDF</p>
                      <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Supports Policy Handbooks & Guides</p>
                      <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dynamic Agent Rules (Text)</label>
                <textarea 
                  value={playbook}
                  onChange={(e) => {
                    setPlaybook(e.target.value);
                    localStorage.setItem('arag_agent_playbook', e.target.value);
                  }}
                  className="w-full h-56 bg-slate-50 border border-slate-200 rounded-[32px] p-8 font-mono text-[11px] text-slate-600 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-inner resize-none leading-relaxed"
                  placeholder="E.g. [RULE: CAR DAMAGE] Ask for police report..."
                />
              </div>
            </div>
            
            <div className="mt-10 pt-8 border-t border-slate-50 flex justify-end">
              <button 
                onClick={() => setIsTrainingOpen(false)}
                className="px-10 py-3.5 bg-indigo-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95"
              >
                Save & Close Playbook
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-indigo-900 text-white px-6 py-4 shadow-md flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-400 p-1.5 rounded text-indigo-900 font-black text-[10px]">ARAG</div>
          <h1 className="text-lg font-bold tracking-tight">Agent Copilot <span className="text-indigo-300 font-normal">v4.3</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setIsCloudSettingsOpen(true)} className="px-3 py-1 rounded bg-indigo-800 border border-indigo-700 text-[9px] font-black uppercase hover:bg-indigo-700 transition-colors">Cloud Sync</button>
          <button onClick={resetWorkspace} className="flex items-center space-x-2 px-4 py-2 rounded-full text-[10px] font-black bg-white/10 hover:bg-white/20 border border-white/10 transition-all">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            <span>NEXT CASE</span>
          </button>
          <div className="h-4 w-px bg-white/20"></div>
          <button 
            onClick={() => setIsTrainingOpen(!isTrainingOpen)} 
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-2 ${isTrainingOpen ? 'bg-yellow-400 text-indigo-900 shadow-lg' : 'bg-indigo-800 text-indigo-100'}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span>PLAYBOOK</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Input Source</h2>
              {playbookPdf && (
                <div className="flex items-center text-[9px] text-emerald-600 font-black uppercase bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse"></div>
                  PDF SYNCED
                </div>
              )}
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block">Target Client</label>
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="ID / Name..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-50 border-transparent outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button onClick={() => setInputMode('image')} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${inputMode === 'image' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>SCREENSHOT</button>
                <button onClick={() => setInputMode('text')} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all ${inputMode === 'text' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}>TEXT ONLY</button>
              </div>

              {inputMode === 'image' ? (
                <label className="relative h-48 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer overflow-hidden group shadow-inner">
                  {previewUrl ? (
                    <img src={previewUrl} className="h-full w-full object-cover" alt="Email Preview" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 inline-block mb-3">
                        <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Select Screenshot</span>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPreviewUrl(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} className="hidden" />
                </label>
              ) : (
                <textarea 
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste email content here..."
                  className="w-full h-48 bg-slate-50 border border-slate-200 rounded-[32px] p-6 text-xs focus:ring-4 focus:ring-indigo-50 outline-none resize-none shadow-inner"
                />
              )}
            </div>
          </div>
          <HistoryView history={clientHistory} />
        </aside>

        <section className="lg:col-span-8 space-y-6">
          {!state.result ? (
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 h-[600px] flex flex-col items-center justify-center text-center p-12 transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <svg className="h-48 w-48 text-indigo-900" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </div>
              <div className="bg-indigo-50 p-8 rounded-full mb-8 animate-pulse shadow-inner border border-indigo-100">
                <svg className="h-16 w-16 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">ARAG Agent Intelligence</h3>
              <p className="text-slate-500 max-w-sm mb-12 text-base leading-relaxed font-medium">Draft compliance-ready, empathetic replies based on company policy and client history.</p>
              
              {state.error && <div className="mb-10 p-5 bg-red-50 text-red-600 text-[10px] font-black rounded-2xl border border-red-100 flex items-center shadow-sm uppercase tracking-widest animate-in shake-in duration-300"><svg className="h-4 w-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{state.error}</div>}

              <button 
                onClick={handleGenerate}
                disabled={state.loading}
                className={`px-20 py-5 rounded-3xl font-black transition-all flex items-center space-x-6 shadow-2xl active:scale-95 ${
                  state.loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200 hover:-translate-y-1'
                }`}
              >
                {state.loading ? (
                  <><svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg><span>ANALYZING KNOWLEDGE...</span></>
                ) : (
                  <><span>RUN CO-PILOT</span><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              <div className="bg-slate-900 text-white px-10 py-6 rounded-[40px] flex items-center justify-between shadow-2xl border border-white/5">
                <div className="flex space-x-16">
                  <div className="border-r border-white/10 pr-16">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Detected Profile</p>
                    <p className="text-xl font-bold flex items-center tracking-tight">{state.result.extractedClientName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Policy Context</p>
                    <p className="text-xl font-bold text-yellow-400 tracking-tight">{state.result.extractedPolicyNumber || 'MISSING POLICY #'}</p>
                  </div>
                </div>
                {playbookPdf && (
                  <div className="bg-indigo-600/20 text-indigo-400 px-5 py-2.5 rounded-2xl text-[10px] font-black border border-indigo-500/30 flex items-center shadow-inner uppercase tracking-widest">
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                    PDF Verified
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 p-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>Synthesis Summary</h3>
                <div className="bg-slate-50 p-8 rounded-3xl text-slate-700 italic border-l-8 border-indigo-600 shadow-inner font-medium leading-relaxed text-base">{state.result.summary}</div>
              </div>

              <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden border-b-8 border-indigo-900">
                <div className="bg-indigo-950 text-white px-10 py-6 flex justify-between items-center">
                  <div className="flex bg-indigo-900/50 p-2 rounded-2xl border border-indigo-800 shadow-inner">
                    <button onClick={() => setActiveLang('en')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeLang === 'en' ? 'bg-indigo-600 shadow-xl scale-105' : 'text-indigo-400 hover:text-indigo-200'}`}>ENGLISH</button>
                    <button onClick={() => setActiveLang('de')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeLang === 'de' ? 'bg-indigo-600 shadow-xl scale-105' : 'text-indigo-400 hover:text-indigo-200'}`}>DEUTSCH</button>
                  </div>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(activeLang === 'en' ? state.result!.replyEnglish : state.result!.replyGerman); alert("Draft Copied!"); }}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-2xl font-black shadow-lg active:scale-95 transition-all border border-indigo-500 uppercase tracking-widest"
                  >
                    Copy {activeLang.toUpperCase()} Draft
                  </button>
                </div>
                <textarea 
                  value={activeLang === 'en' ? state.result.replyEnglish : state.result.replyGerman}
                  readOnly
                  className="w-full h-[450px] p-16 font-mono text-[15px] text-slate-800 outline-none resize-none border-none leading-loose bg-white"
                />
                <div className="bg-slate-50 px-10 py-8 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <svg className="h-4 w-4 mr-2 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Compliance Status: ARAG Policy Verified
                  </p>
                  <div className="flex space-x-8">
                    <button onClick={() => setState({loading: false, error: null, result: null})} className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Edit Analysis</button>
                    <button onClick={resetWorkspace} className="px-12 py-4 bg-indigo-900 text-white rounded-2xl font-black text-[10px] shadow-xl hover:bg-black transition-all flex items-center space-x-3 group active:scale-95 uppercase tracking-widest">
                      <span>NEXT CASE</span>
                      <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
