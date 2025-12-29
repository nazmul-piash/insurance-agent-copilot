
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
          console.error("Cloud update failed, local fallback active.");
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
      console.error("Analysis Error:", err);
      setState({ loading: false, error: err.message || "Analysis failed.", result: null });
    }
  };

  const saveCloudSettings = (settings: CloudSettings) => {
    setCloudSettings(settings);
    localStorage.setItem('arag_cloud_settings', JSON.stringify(settings));
    setIsCloudSettingsOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {isSetupOpen && <SetupGuide onClose={() => setIsSetupOpen(false)} />}
      
      {isCloudSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-slate-800 mb-2">Cloud Configuration</h2>
            <p className="text-sm text-slate-500 mb-6">Connect to Supabase for team-wide shared memory.</p>
            <div className="space-y-4">
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
              <label className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-50 rounded-xl">
                <input 
                  type="checkbox" 
                  checked={cloudSettings.enabled} 
                  onChange={e => setCloudSettings({...cloudSettings, enabled: e.target.checked})}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">Enable Cloud Syncing</span>
              </label>
            </div>
            <div className="mt-8 flex space-x-3">
              <button onClick={() => setIsCloudSettingsOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">Cancel</button>
              <button onClick={() => saveCloudSettings(cloudSettings)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg">Save Settings</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-indigo-900 text-white px-6 py-4 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-400 p-1.5 rounded text-indigo-900 font-black text-xs">ARAG</div>
          <h1 className="text-lg font-bold tracking-tight">Agent Copilot <span className="text-indigo-300 font-normal">v4.1</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setIsCloudSettingsOpen(true)} className="px-3 py-1 rounded bg-indigo-800 border border-indigo-700 text-[10px] font-black uppercase">Cloud Settings</button>
          <button onClick={resetWorkspace} className="flex items-center space-x-2 px-4 py-2 rounded-full text-[10px] font-black bg-white/10 hover:bg-white/20 border border-white/10 transition-all">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            <span>NEXT CASE</span>
          </button>
          <div className="h-4 w-px bg-white/20"></div>
          <button 
            onClick={() => setIsTrainingOpen(!isTrainingOpen)} 
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-2 ${isTrainingOpen ? 'bg-yellow-400 text-indigo-900 shadow-lg scale-105' : 'bg-indigo-800 text-indigo-100'}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span>PLAYBOOK</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Input Source</h2>
              {playbookPdf && (
                <div className="flex items-center text-[10px] text-emerald-600 font-black uppercase">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1 animate-pulse"></div>
                  PDF Active
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Target Client</label>
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Auto-detecting Name/ID..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setInputMode('image')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${inputMode === 'image' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>SCREENSHOT</button>
                <button onClick={() => setInputMode('text')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${inputMode === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>TEXT ONLY</button>
              </div>

              {inputMode === 'image' ? (
                <div className="relative h-44 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden group shadow-inner">
                  {previewUrl ? (
                    <img src={previewUrl} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <svg className="h-8 w-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Drop Screenshot</span>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPreviewUrl(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              ) : (
                <textarea 
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste email content here..."
                  className="w-full h-44 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"
                />
              )}
            </div>
          </div>
          <HistoryView history={clientHistory} />
        </aside>

        <section className="lg:col-span-8 space-y-6">
          {isTrainingOpen && (
            <div className="bg-white border border-indigo-200 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 z-10 relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-indigo-900 text-sm uppercase flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Agent Intelligence Center
                </h3>
                <button onClick={() => setIsTrainingOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors">
                   <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Official Policy PDF</label>
                  <div className={`relative border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col items-center justify-center h-32 ${playbookPdf ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300'}`}>
                    {playbookPdf ? (
                      <div className="text-center relative z-20">
                        <svg className="h-8 w-8 text-indigo-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-[10px] font-bold text-indigo-900 truncate max-w-[150px] mb-1">{playbookPdfName}</p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlaybookPdf(null); 
                            setPlaybookPdfName(null);
                          }} 
                          className="text-[9px] text-white bg-red-500 px-3 py-1 rounded-full font-black shadow-sm hover:bg-red-600 transition-colors"
                        >
                          REMOVE FILE
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="h-6 w-6 text-slate-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Upload PDF Guide</p>
                      </div>
                    )}
                    {!playbookPdf && (
                      <input 
                        type="file" 
                        accept=".pdf" 
                        onChange={handlePdfUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Custom Rules (Text)</label>
                  <textarea 
                    value={playbook}
                    onChange={(e) => {
                      setPlaybook(e.target.value);
                      localStorage.setItem('arag_agent_playbook', e.target.value);
                    }}
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs text-slate-600 outline-none focus:ring-2 focus:ring-indigo-400 transition-all shadow-inner resize-none"
                    placeholder="E.g. [RULE: CAR DAMAGE] Ask for police report..."
                  />
                </div>
              </div>
            </div>
          )}

          {!state.result ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 h-[500px] flex flex-col items-center justify-center text-center p-12 transition-all">
              <div className="bg-indigo-50 p-6 rounded-full mb-6 animate-pulse">
                <svg className="h-12 w-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">AI Knowledge Synthesis</h3>
              <p className="text-slate-500 max-w-sm mb-10 text-sm leading-relaxed font-medium">Input client details and policy guidelines. AI will cross-reference everything to generate the perfect reply.</p>
              
              {state.error && <div className="mb-8 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100 flex items-center shadow-sm animate-in shake-in duration-300"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{state.error}</div>}

              <button 
                onClick={handleGenerate}
                disabled={state.loading}
                className={`px-14 py-4 rounded-2xl font-black transition-all flex items-center space-x-4 shadow-2xl ${
                  state.loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'
                }`}
              >
                {state.loading ? (
                  <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg><span>ANALYZING...</span></>
                ) : (
                  <><span>RUN CO-PILOT</span><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              <div className="bg-emerald-900 text-emerald-50 px-8 py-5 rounded-3xl flex items-center justify-between shadow-2xl border border-emerald-800">
                <div className="flex space-x-10">
                  <div className="border-r border-emerald-800 pr-10">
                    <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">Detected Client</p>
                    <p className="text-lg font-bold flex items-center"><svg className="h-4 w-4 mr-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>{state.result.extractedClientName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1">Policy Context</p>
                    <p className="text-lg font-bold flex items-center text-emerald-400">{state.result.extractedPolicyNumber || 'NEEDS POLICY #'}</p>
                  </div>
                </div>
                {playbookPdf && <div className="bg-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg flex items-center border border-indigo-500 animate-pulse"><svg className="h-3.5 w-3.5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" /></svg>PDF SYNCED</div>}
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center"><svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>Agent Briefing</h3>
                <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 italic border-l-8 border-indigo-500 shadow-inner font-medium leading-relaxed">{state.result.summary}</div>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden border-b-8 border-indigo-900">
                <div className="bg-indigo-950 text-white px-8 py-5 flex justify-between items-center">
                  <div className="flex bg-indigo-900/50 p-1.5 rounded-xl border border-indigo-800">
                    <button onClick={() => setActiveLang('en')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeLang === 'en' ? 'bg-indigo-600 shadow-xl scale-105' : 'text-indigo-400 hover:text-indigo-200'}`}>ENGLISH</button>
                    <button onClick={() => setActiveLang('de')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${activeLang === 'de' ? 'bg-indigo-600 shadow-xl scale-105' : 'text-indigo-400 hover:text-indigo-200'}`}>DEUTSCH</button>
                  </div>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(activeLang === 'en' ? state.result!.replyEnglish : state.result!.replyGerman); alert("Draft Copied!"); }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl font-black shadow-lg active:scale-90 transition-all border border-indigo-500"
                  >
                    COPY {activeLang.toUpperCase()} REPLY
                  </button>
                </div>
                <textarea 
                  value={activeLang === 'en' ? state.result.replyEnglish : state.result.replyGerman}
                  readOnly
                  className="w-full h-[380px] p-10 font-mono text-sm text-slate-800 outline-none resize-none border-none leading-relaxed bg-white selection:bg-indigo-100"
                />
                <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Status: Verified Against Playbook</p>
                  <div className="flex space-x-6">
                    <button onClick={() => setState({loading: false, error: null, result: null})} className="text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Back to Briefing</button>
                    <button onClick={resetWorkspace} className="px-10 py-3 bg-indigo-900 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-black transition-all flex items-center space-x-2 group">
                      <span>NEXT CASE</span>
                      <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
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
