
import React, { useState, useEffect, useRef } from 'react';
import { generateInsuranceReply } from './services/geminiService';
import { HistoryView } from './components/HistoryView';
import { SetupGuide } from './components/SetupGuide';
import { InteractionSummary, AnalysisState, CloudSettings } from './types';

const DEFAULT_PLAYBOOK = `[RULE: ADDRESS CHANGE]
- Ask for "Effective Date" of the move.
- Verify policies: Householders, Liability, Legal.
- Ask if bank details (IBAN) changed.

[RULE: EMOTIONAL TONE]
- If 'Urgent': Confirm receipt immediately.
- If 'Frustrated': Apologize for the friction first.

[RULE: STYLE]
- Professional and warm.
- Sign off: "Best regards, Your ARAG Team"`;

const App: React.FC = () => {
  const [clientId, setClientId] = useState('');
  const [inputMode, setInputMode] = useState<'image' | 'text'>('image');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [emailText, setEmailText] = useState('');
  const [clientHistory, setClientHistory] = useState<InteractionSummary[]>([]);
  const [playbook, setPlaybook] = useState(DEFAULT_PLAYBOOK);
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
      const result = await generateInsuranceReply(inputData, clientId, clientHistory, playbook);
      
      const finalClientId = clientId || result.extractedClientName;
      if (!clientId && result.extractedClientName) {
        setClientId(result.extractedClientName);
      }

      const newEntry: InteractionSummary = {
        date: new Date().toLocaleString(),
        summary: result.summary,
        policyNumber: result.extractedPolicyNumber || undefined,
      };

      if (cloudSettings.enabled) {
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
          console.error("Cloud update failed, using local fallback.");
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {isSetupOpen && <SetupGuide onClose={() => setIsSetupOpen(false)} />}

      <nav className="bg-indigo-900 text-white px-6 py-4 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="bg-yellow-400 p-1.5 rounded text-indigo-900 font-black text-xs">ARAG</div>
          <h1 className="text-lg font-bold tracking-tight">Agent Copilot <span className="text-indigo-300 font-normal">v3.1</span></h1>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={resetWorkspace}
            className="flex items-center space-x-2 px-4 py-2 rounded-full text-[10px] font-black bg-white/10 hover:bg-white/20 transition-all border border-white/10"
            title="Full Workspace Reset"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span>NEW THREAD</span>
          </button>
          <div className="h-4 w-px bg-white/20"></div>
          <button onClick={() => setIsTrainingOpen(!isTrainingOpen)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${isTrainingOpen ? 'bg-yellow-400 text-indigo-900' : 'bg-indigo-800 text-indigo-100'}`}>PLAYBOOK</button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Input Mapping</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Client ID / Name</label>
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Leave blank to auto-detect"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setInputMode('image')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${inputMode === 'image' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>SCREENSHOT</button>
                <button onClick={() => setInputMode('text')} className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${inputMode === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>EMAIL TEXT</button>
              </div>

              {inputMode === 'image' ? (
                <div className="relative h-40 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden group">
                  {previewUrl ? (
                    <img src={previewUrl} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-slate-400">Upload Screenshot</span>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setPreviewUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                  />
                </div>
              ) : (
                <textarea 
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste email content here..."
                  className="w-full h-40 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              )}
            </div>
          </div>
          <HistoryView history={clientHistory} />
        </aside>

        <section className="lg:col-span-8 space-y-6">
          {isTrainingOpen && (
            <div className="bg-white border border-indigo-200 rounded-2xl p-6 shadow-sm animate-in fade-in duration-300">
              <h3 className="font-bold text-indigo-900 mb-4 flex items-center text-sm uppercase">Agent Playbook</h3>
              <textarea 
                value={playbook}
                onChange={(e) => setPlaybook(e.target.value)}
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-600 outline-none"
              />
            </div>
          )}

          {!state.result ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[500px] flex flex-col items-center justify-center text-center p-12">
              <div className="bg-indigo-50 p-4 rounded-full mb-6">
                <svg className="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to Analyze</h3>
              <p className="text-slate-500 max-w-sm mb-8 text-sm leading-relaxed">AI will extract the name and policy number automatically to fetch relevant history and draft bilingual replies.</p>
              
              {state.error && <div className="mb-6 p-3 bg-red-50 text-red-600 text-[10px] font-black rounded-lg border border-red-100 animate-in shake duration-300">{state.error}</div>}

              <div className="flex items-center space-x-4">
                <button 
                  onClick={handleGenerate}
                  disabled={state.loading}
                  className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {state.loading ? 'ANALYZING...' : 'RUN CO-PILOT'}
                </button>
                <button 
                  onClick={resetWorkspace}
                  className="p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 hover:text-slate-600 transition-all"
                  title="Clear All Inputs"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              {/* Data Extraction Info Bar */}
              <div className="bg-emerald-900 text-emerald-50 px-6 py-3 rounded-2xl flex items-center justify-between shadow-lg">
                <div className="flex space-x-6">
                  <div>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Client Name</p>
                    <p className="text-sm font-bold">{state.result.extractedClientName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Policy Number</p>
                    <p className="text-sm font-bold">{state.result.extractedPolicyNumber || '⚠️ MISSING - REQUESTED'}</p>
                  </div>
                </div>
                <div className="bg-emerald-800 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-700">MAPPED</div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Internal Analysis</h3>
                <div className="bg-slate-50 p-4 rounded-xl text-slate-700 italic border-l-4 border-indigo-400 shadow-inner">{state.result.summary}</div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="bg-indigo-900 text-white px-6 py-4 flex justify-between items-center">
                  <div className="flex bg-indigo-950 p-1 rounded-lg">
                    <button onClick={() => setActiveLang('en')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${activeLang === 'en' ? 'bg-indigo-600 shadow-md' : 'text-indigo-400 hover:text-indigo-200'}`}>EN</button>
                    <button onClick={() => setActiveLang('de')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${activeLang === 'de' ? 'bg-indigo-600 shadow-md' : 'text-indigo-400 hover:text-indigo-200'}`}>DE</button>
                  </div>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(activeLang === 'en' ? state.result!.replyEnglish : state.result!.replyGerman); alert("Draft Copied!"); }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg font-bold transition-all shadow-md active:scale-95"
                  >
                    COPY {activeLang.toUpperCase()} DRAFT
                  </button>
                </div>
                <textarea 
                  value={activeLang === 'en' ? state.result.replyEnglish : state.result.replyGerman}
                  readOnly
                  className="w-full h-[350px] p-8 font-mono text-sm text-slate-800 outline-none resize-none border-none leading-relaxed"
                />
                <div className="bg-slate-50 px-6 py-6 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 italic">Work completed. Ready for the next task?</p>
                  <div className="flex space-x-4">
                    <button 
                      onClick={() => setState({loading: false, error: null, result: null})} 
                      className="text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      EDIT DRAFT
                    </button>
                    <button 
                      onClick={resetWorkspace}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95 flex items-center"
                    >
                      <svg className="h-3.5 w-3.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      START NEXT CASE
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
