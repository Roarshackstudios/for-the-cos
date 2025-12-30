import React, { useState, useRef, useEffect } from 'react';
import { AppStep, AppState, Category, Subcategory, CardStats, AdminSettings, SavedGeneration, ApiLog, PhysicalOrder } from './types';
import { CATEGORIES } from './constants';
import PhotoStep from './components/PhotoStep';
import Carousel from './components/Carousel';
import ComicFrame from './components/ComicFrame';
import TradingCard from './components/TradingCard';
import { processCosplayImage } from './services/gemini';
import { toPng } from 'html-to-image';
import { saveGeneration, getAllGenerations, deleteGeneration, logApiCall, saveOrder } from './services/db';

type ExportType = 'raw' | 'comic' | 'card-front' | 'card-back' | 'card-bundle';

const SESSION_ID = 'user-' + Math.random().toString(36).substring(2, 9);
const COST_PER_GENERATION = 0.015;

const App: React.FC = () => {
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {
    const saved = localStorage.getItem('cos-admin-settings');
    return saved ? JSON.parse(saved) : {
      defaultTitle: "THE LEGENDARY",
      defaultDescription: "The manifestation of this masterpiece represents a perfect fusion of craftsmanship and character essence. Every detail, from props to pose, has been analyzed and enhanced through our digital shifting matrix.",
      paypalClientIdSandbox: "test", 
      paypalClientIdProduction: "",
      isPaypalProduction: false,
      priceComicPrint: 14.99,
      priceCardSet: 8.99,
      supabaseUrl: "",
      supabaseAnonKey: ""
    };
  });

  const [galleryItems, setGalleryItems] = useState<SavedGeneration[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<'pending' | 'ready'>('pending');

  const isSupabaseConfigured = !!(adminSettings.supabaseUrl?.trim().startsWith('http') && adminSettings.supabaseAnonKey?.trim());

  const [state, setState] = useState<AppState>({
    step: AppStep.UPLOAD,
    currentUser: null,
    sourceImage: null,
    selectedCategory: null,
    selectedSubcategory: null,
    customPrompt: '',
    resultImage: null,
    isComicStyled: false,
    isCardStyled: false,
    stats: null,
    characterName: '',
    characterDescription: '',
    cardStatusText: 'PREMIUM COLLECTOR',
    styleIntensity: 80, 
    resultScale: 1,
    resultOffset: { x: 0, y: 0 },
    error: null,
    editingId: null
  });

  useEffect(() => {
    const checkAiKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) setAiKeyStatus('ready');
      } else {
        setAiKeyStatus('ready'); 
      }
    };
    checkAiKey();
    loadGallery();
  }, [isSupabaseConfigured]);

  const [isFlipped, setIsFlipped] = useState(false);
  const [activeExport, setActiveExport] = useState<ExportType | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Initializing systems...");
  
  const rawImageRef = useRef<HTMLDivElement>(null);
  const comicExportRef = useRef<HTMLDivElement>(null);
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);
  
  const logoUrl = "https://i.ibb.co/b43T8dM/1.png";

  useEffect(() => {
    localStorage.setItem('cos-admin-settings', JSON.stringify(adminSettings));
  }, [adminSettings]);

  const loadGallery = async () => {
    try {
      const items = await getAllGenerations();
      setGalleryItems(items);
    } catch (e: any) { 
      console.error("Gallery load failed", e);
    }
  };

  const handlePhotoSelected = (base64: string) => {
    setState(prev => ({ ...prev, sourceImage: base64, step: AppStep.CATEGORY_SELECT, error: null, editingId: null }));
  };

  const startProcessing = async () => {
    // @ts-ignore
    if (window.aistudio?.hasSelectedApiKey) {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setAiKeyStatus('ready');
      }
    }

    if (!state.sourceImage || !state.selectedCategory) return;
    setState(prev => ({ ...prev, step: AppStep.PROCESSING, error: null }));
    
    const interval = setInterval(() => {
      setLoadingMessage(prev => prev === "Analyzing..." ? "Polishing..." : "Analyzing...");
    }, 2500);

    try {
      const result = await processCosplayImage(
        state.sourceImage,
        state.selectedCategory.name,
        state.selectedSubcategory?.name || "Auto Detect",
        state.styleIntensity,
        state.customPrompt
      );
      
      setState(prev => ({ 
        ...prev, 
        resultImage: result, 
        step: AppStep.RESULT,
        stats: { strength: 5, intelligence: 6, energy: 4, mental: 5, fighting: 7, speed: 5 },
        characterName: `${adminSettings.defaultTitle} ${state.selectedSubcategory?.name || 'HERO'}`,
        characterDescription: adminSettings.defaultDescription,
        cardStatusText: 'PREMIUM COLLECTOR',
        resultScale: 1,
        resultOffset: { x: 0, y: 0 }
      }));
      
      await logApiCall({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        userSession: SESSION_ID,
        model: 'gemini-2.5-flash-image',
        category: state.selectedCategory.name,
        subcategory: state.selectedSubcategory?.name || 'Custom',
        cost: COST_PER_GENERATION,
        status: 'success'
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, step: AppStep.UPLOAD }));
    } finally {
      clearInterval(interval);
    }
  };

  const downloadResult = async (type: ExportType) => {
    if (!state.resultImage || activeExport) return;
    setActiveExport(type);

    try {
      let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
      if (type === 'raw') targetRef = rawImageRef;
      else if (type === 'comic') targetRef = comicExportRef;
      else if (type === 'card-front') targetRef = cardFrontRef;
      else if (type === 'card-back') targetRef = cardBackRef;

      if (targetRef?.current) {
        const dataUrl = await toPng(targetRef.current, { pixelRatio: 2, cacheBust: true });
        const link = document.createElement('a');
        link.download = `cosplay_${type}_${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActiveExport(null);
    }
  };

  const saveToHistory = async () => {
    if (!state.resultImage || isSaving) return;
    
    setIsSaving(true);
    try {
      let targetRef = state.isComicStyled ? comicExportRef : (state.isCardStyled ? cardFrontRef : rawImageRef);
      if (targetRef.current) {
        const dataUrl = await toPng(targetRef.current);
        await saveGeneration({
          id: state.editingId || crypto.randomUUID(),
          timestamp: Date.now(),
          image: dataUrl,
          name: state.characterName,
          category: state.selectedCategory?.name || 'Unknown',
          type: state.isComicStyled ? 'comic' : (state.isCardStyled ? 'card' : 'raw'),
          stats: state.stats || undefined,
          description: state.characterDescription,
          cardStatusText: state.cardStatusText,
          originalSourceImage: state.sourceImage || undefined
        });
        await loadGallery();
        alert(isSupabaseConfigured ? "Synced to Cloud Chronicles." : "Saved to Local Vault.");
      }
    } catch (err: any) {
      alert(`Sync Error: ${err.message}. Your progress was saved locally as a precaution.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePurchase = async (itemType: 'comic' | 'card') => {
    const price = itemType === 'comic' ? adminSettings.priceComicPrint : adminSettings.priceCardSet;
    const itemName = itemType === 'comic' ? "High-Gloss Comic Print" : "Holographic Card Set";

    if (confirm(`Authorize purchase of ${itemName} for $${price}?`)) {
      alert("Simulated transaction successful!");
      
      let targetRef = itemType === 'comic' ? comicExportRef : cardFrontRef;
      const previewUrl = targetRef.current ? await toPng(targetRef.current) : '';
      
      await saveOrder({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        paypalOrderId: 'MOCK-' + Math.random().toString(36).substring(7).toUpperCase(),
        itemType,
        itemName,
        amount: price,
        status: 'paid',
        previewImage: previewUrl
      });
      alert("Artifact production queued.");
    }
  };

  const goBack = () => {
    if (state.step === AppStep.CATEGORY_SELECT) setState(prev => ({ ...prev, step: AppStep.UPLOAD }));
    else if (state.step === AppStep.SUBCATEGORY_SELECT) setState(prev => ({ ...prev, step: AppStep.CATEGORY_SELECT }));
    else if (state.step === AppStep.RESULT) setState(prev => ({ ...prev, step: AppStep.SUBCATEGORY_SELECT }));
    else if (state.step === AppStep.GALLERY) setState(prev => ({ ...prev, step: AppStep.UPLOAD }));
  };

  const handleTransform = (axis: 'x' | 'y' | 'scale', value: number) => {
    setState(prev => {
      if (axis === 'scale') return { ...prev, resultScale: value };
      return { ...prev, resultOffset: { ...prev.resultOffset, [axis]: value } };
    });
  };

  const triggerApiKeySelection = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setAiKeyStatus('ready');
    }
  };

  const resetSupabase = () => {
    if (confirm("Reset cloud credentials and return to Local Vault mode? This will force a page reload.")) {
      setAdminSettings(prev => ({ ...prev, supabaseUrl: "", supabaseAnonKey: "" }));
      localStorage.removeItem('cos-admin-settings'); // Clear local storage to be sure
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-inter">
      {/* HEADER */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-zinc-900 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center cursor-pointer" onClick={() => setState(prev => ({ ...prev, step: AppStep.UPLOAD }))}>
          <img src={logoUrl} className="w-12 h-12 object-contain" alt="Logo" />
          <h1 className="text-xl font-orbitron font-bold tracking-tighter uppercase ml-3">FOR THE <span className="text-blue-500">COS</span></h1>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex flex-col items-end mr-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Sync: {isSupabaseConfigured ? 'Cloud Mode' : 'Local Vault'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${aiKeyStatus === 'ready' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></div>
              <button onClick={triggerApiKeySelection} className="text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors">AI Neural: {aiKeyStatus === 'ready' ? 'Active' : 'Missing Key'}</button>
            </div>
          </div>

          <button onClick={() => setShowAdmin(!showAdmin)} className="text-zinc-500 hover:text-white transition-colors">
            <i className="fa-solid fa-gear"></i>
          </button>

          <button onClick={() => setState(prev => ({ ...prev, step: AppStep.GALLERY }))} className="text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white">Chronicles</button>

          {state.step !== AppStep.UPLOAD && state.step !== AppStep.PROCESSING && (
            <button onClick={goBack} className="text-sm font-bold uppercase tracking-widest text-zinc-500 hover:text-white">Back</button>
          )}
        </div>
      </header>

      {/* ADMIN MODAL */}
      {showAdmin && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 backdrop-blur-md animate-fade-in">
          <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"></div>
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-orbitron font-black uppercase italic tracking-tighter text-blue-500">Matrix Config</h2>
              <button onClick={() => setShowAdmin(false)} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-times text-2xl"></i></button>
            </div>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto px-2 custom-scrollbar">
              
              <div className="p-6 bg-blue-600/10 border border-blue-500/30 rounded-3xl space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Cloud Synchronization (Supabase)</p>
                  <div className={`px-2 py-1 rounded text-[8px] font-bold uppercase ${isSupabaseConfigured ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {isSupabaseConfigured ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                
                <div className="text-[10px] text-zinc-400 leading-relaxed bg-black/30 p-4 rounded-xl space-y-2">
                  <p className="font-bold text-white uppercase italic tracking-wider">How to connect your Cloud Chronicles:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Create a project at <a href="https://supabase.com" target="_blank" className="text-blue-400 underline">supabase.com</a></li>
                    <li>Go to <b>Project Settings > API</b></li>
                    <li>Copy <b>Project URL</b> into the field below</li>
                    <li>Copy <b>anon public</b> API key into the field below</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Supabase URL</label>
                    <input 
                      type="text" 
                      placeholder="https://your-project.supabase.co" 
                      value={adminSettings.supabaseUrl} 
                      onChange={e => setAdminSettings({...adminSettings, supabaseUrl: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-xs focus:border-blue-500 outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Supabase Anon Key</label>
                    <input 
                      type="password" 
                      placeholder="eyJhbGciOiJIUzI1..." 
                      value={adminSettings.supabaseAnonKey} 
                      onChange={e => setAdminSettings({...adminSettings, supabaseAnonKey: e.target.value})}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-xs focus:border-blue-500 outline-none font-mono"
                    />
                  </div>
                  <button onClick={resetSupabase} className="text-[9px] font-black uppercase text-red-500/50 hover:text-red-500 transition-colors mt-2">Emergency: Clear Cloud Credentials</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Global Artifact Prefix</label>
                <input type="text" value={adminSettings.defaultTitle} onChange={e => setAdminSettings({...adminSettings, defaultTitle: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Global Template Bio</label>
                <textarea value={adminSettings.defaultDescription} onChange={e => setAdminSettings({...adminSettings, defaultDescription: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm h-32 focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Comic Print Price ($)</label>
                  <input type="number" value={adminSettings.priceComicPrint} onChange={e => setAdminSettings({...adminSettings, priceComicPrint: parseFloat(e.target.value)})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Card Set Price ($)</label>
                  <input type="number" value={adminSettings.priceCardSet} onChange={e => setAdminSettings({...adminSettings, priceCardSet: parseFloat(e.target.value)})} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <button onClick={() => {
              setShowAdmin(false);
              window.location.reload(); 
            }} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-500/20">Finalize Config & Sync</button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-grow flex flex-col justify-center">
        {state.step === AppStep.UPLOAD && <PhotoStep onPhotoSelected={handlePhotoSelected} />}
        
        {state.step === AppStep.CATEGORY_SELECT && (
          <div className="py-12 animate-fade-in">
            <Carousel items={CATEGORIES} onItemSelect={(cat) => setState(prev => ({ ...prev, selectedCategory: cat, step: AppStep.SUBCATEGORY_SELECT }))} title="SELECT DIMENSION" />
          </div>
        )}

        {state.step === AppStep.SUBCATEGORY_SELECT && (
          <div className="py-12 animate-fade-in">
            <Carousel 
              items={state.selectedCategory?.subcategories || []} 
              onItemSelect={(sub) => setState(prev => ({ ...prev, selectedSubcategory: sub }))} 
              title={`${state.selectedCategory?.name} DOMAINS`}
              isSubView={true}
              onBack={goBack}
              onConfirm={startProcessing}
              selectedIndex={state.selectedCategory?.subcategories?.findIndex(s => s.id === state.selectedSubcategory?.id)}
            />
          </div>
        )}

        {state.step === AppStep.PROCESSING && (
          <div className="flex flex-col items-center justify-center space-y-8 p-12">
            <div className="w-48 h-48 relative flex items-center justify-center">
              <img src={logoUrl} className="w-full h-full object-contain animate-heartbeat" alt="logo" />
            </div>
            <h2 className="text-3xl font-orbitron font-bold text-blue-500 animate-pulse uppercase tracking-widest">Neural Shifting</h2>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.4em]">{loadingMessage}</p>
          </div>
        )}

        {state.step === AppStep.RESULT && state.resultImage && (
          <div className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 animate-fade-in">
            
            {/* EXPORT TARGETS (HIDDEN) */}
            <div className="absolute left-[-9999px] top-0 overflow-hidden">
              <div ref={rawImageRef} style={{ width: '800px', height: '1000px' }}><img src={state.resultImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
              <div ref={comicExportRef} style={{ width: '800px', height: '1200px', position: 'relative' }}>
                <img src={state.resultImage} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                <ComicFrame category={state.selectedCategory?.name || "HERO"} subcategory={state.selectedSubcategory?.name || "ULTIMATE"} customTitle={state.characterName} />
              </div>
              <div ref={cardFrontRef} style={{ width: '900px', height: '1200px' }}>
                <TradingCard frontImage={state.resultImage} backImage={state.sourceImage!} stats={state.stats!} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={false} onFlip={() => {}} exportSide="front" imageScale={state.resultScale} imageOffset={state.resultOffset} statusText={state.cardStatusText} />
              </div>
              <div ref={cardBackRef} style={{ width: '900px', height: '1200px' }}>
                <TradingCard frontImage={state.resultImage} backImage={state.sourceImage!} stats={state.stats!} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={true} onFlip={() => {}} exportSide="back" statusText={state.cardStatusText} />
              </div>
            </div>

            {/* PREVIEW AREA */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col items-center space-y-8">
              <div className={`relative w-full max-w-md bg-black rounded-3xl overflow-hidden border-[8px] border-zinc-900 shadow-2xl transition-all duration-500 ${state.isComicStyled ? 'aspect-[2/3]' : 'aspect-[3/4]'}`}>
                {state.isComicStyled ? (
                  <div className="w-full h-full relative">
                    <img src={state.resultImage} className="w-full h-full object-cover" style={{ transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                    <ComicFrame category={state.selectedCategory?.name || "HERO"} subcategory={state.selectedSubcategory?.name || "ULTIMATE"} customTitle={state.characterName} />
                  </div>
                ) : state.isCardStyled ? (
                  <TradingCard frontImage={state.resultImage} backImage={state.sourceImage!} stats={state.stats!} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} imageScale={state.resultScale} imageOffset={state.resultOffset} statusText={state.cardStatusText} />
                ) : (
                  <img src={state.resultImage} className="w-full h-full object-cover" />
                )}
              </div>
              
              <div className="flex flex-wrap gap-4 w-full max-w-md justify-center">
                {state.isCardStyled ? (
                  <>
                    <button onClick={() => downloadResult('card-front')} className="flex-1 min-w-[140px] py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg">Export Card Front</button>
                    <button onClick={() => downloadResult('card-back')} className="flex-1 min-w-[140px] py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md">Export Card Back</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => downloadResult('raw')} className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Download PNG</button>
                    {state.isComicStyled && <button onClick={() => downloadResult('comic')} className="flex-1 py-4 bg-yellow-600 hover:bg-yellow-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black transition-all shadow-lg">Comic Export</button>}
                  </>
                )}
              </div>

              {/* TRANSFORM CONTROLS */}
              <div className="w-full max-w-md bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 space-y-6 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Image Matrix Scaling</span>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full">{Math.round(state.resultScale * 100)}%</span>
                </div>
                <input type="range" min="1" max="5" step="0.05" value={state.resultScale} onChange={e => handleTransform('scale', parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex justify-between">H-Offset <span>{state.resultOffset.x}%</span></label>
                    <input type="range" min="-100" max="100" value={state.resultOffset.x} onChange={e => handleTransform('x', parseInt(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex justify-between">V-Offset <span>{state.resultOffset.y}%</span></label>
                    <input type="range" min="-100" max="100" value={state.resultOffset.y} onChange={e => handleTransform('y', parseInt(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION PANEL */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-8">
              <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-zinc-800 space-y-8 backdrop-blur-xl">
                <h3 className="font-orbitron font-black text-xl text-blue-500 italic uppercase">IDENTITY MATRIX</h3>
                
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-2">Display Alias</label>
                    <input type="text" value={state.characterName} onChange={(e) => setState(prev => ({ ...prev, characterName: e.target.value }))} className="w-full bg-black/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Character Name" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-2">Origin Narrative</label>
                    <textarea value={state.characterDescription} onChange={(e) => setState(prev => ({ ...prev, characterDescription: e.target.value }))} className="w-full bg-black/50 border border-zinc-800 rounded-2xl px-6 py-4 text-sm outline-none focus:border-blue-500 h-28 resize-none" placeholder="Character Bio" />
                  </div>
                  
                  {state.isCardStyled && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-2">Collector Rank Text</label>
                      <input type="text" value={state.cardStatusText} onChange={(e) => setState(prev => ({ ...prev, cardStatusText: e.target.value }))} className="w-full bg-black/50 border border-zinc-800 rounded-2xl px-6 py-4 text-xs font-bold text-blue-400 outline-none focus:border-blue-500 uppercase" placeholder="e.g. PREMIUM COLLECTOR" />
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setState(prev => ({ ...prev, isComicStyled: !prev.isComicStyled, isCardStyled: false }))} className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${state.isComicStyled ? 'bg-yellow-500 text-black border-yellow-300 shadow-lg scale-[1.02]' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>Comic Mode</button>
                  <button onClick={() => setState(prev => ({ ...prev, isCardStyled: !prev.isCardStyled, isComicStyled: false }))} className={`py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${state.isCardStyled ? 'bg-blue-600 border-blue-400 shadow-lg scale-[1.02]' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>Card Mode</button>
                </div>

                <button onClick={saveToHistory} disabled={isSaving} className="w-full py-5 bg-white text-black rounded-full font-black uppercase tracking-widest flex items-center justify-center space-x-3 hover:bg-blue-500 hover:text-white transition-all shadow-xl disabled:opacity-50 active:scale-95">
                  {isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                  <span>{isSaving ? 'Synchronizing...' : 'Save to History'}</span>
                </button>
              </div>

              {/* PHYSICAL ORDER */}
              <div className="bg-blue-600/10 border-2 border-blue-500/30 p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <i className="fa-solid fa-box-open text-8xl"></i>
                </div>
                <h3 className="font-orbitron font-black text-xl text-white uppercase italic tracking-tight">Physical Manifest</h3>
                <p className="text-zinc-400 text-[11px] leading-relaxed uppercase font-bold tracking-widest">Order a high-fidelity physical manifestation of this artifact delivered to your coordinates.</p>
                
                <div className="space-y-4">
                  {state.isComicStyled ? (
                    <button onClick={() => handlePurchase('comic')} className="w-full py-5 bg-yellow-500 text-black rounded-2xl font-black uppercase text-xs hover:scale-[1.02] transition-transform flex justify-between px-8 items-center shadow-lg border border-yellow-300/50">
                      <span>Order Glossy Print</span>
                      <span className="bg-black/10 px-3 py-1 rounded-lg">${adminSettings.priceComicPrint}</span>
                    </button>
                  ) : (
                    <button onClick={() => handlePurchase('card')} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs hover:scale-[1.02] transition-transform flex justify-between px-8 items-center shadow-lg border border-blue-400/50">
                      <span>Holographic Card Set</span>
                      <span className="bg-white/10 px-3 py-1 rounded-lg">${adminSettings.priceCardSet}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {state.step === AppStep.GALLERY && (
          <div className="p-8 max-w-7xl mx-auto w-full space-y-12 animate-fade-in">
             <div className="flex justify-between items-end border-b border-zinc-900 pb-8">
               <h2 className="text-5xl font-orbitron font-black italic uppercase text-white">Chronicles</h2>
               <button onClick={() => setState(prev => ({ ...prev, step: AppStep.UPLOAD }))} className="bg-blue-600 px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-500 transition-colors">New Expedition</button>
             </div>
             
             {galleryItems.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-40 space-y-6 opacity-20">
                 <i className="fa-solid fa-dna text-7xl animate-pulse"></i>
                 <p className="font-orbitron font-bold uppercase tracking-[0.5em] text-sm">No records archived in this node</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                 {galleryItems.map(item => (
                   <div key={item.id} className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden group hover:border-blue-500/50 transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                     <div className="aspect-[3/4] relative bg-black overflow-hidden">
                       <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={item.name} />
                       <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-8 flex-col">
                         <button onClick={() => deleteGeneration(item.id).then(loadGallery)} className="w-full py-4 bg-red-600/20 text-red-500 border border-red-500/40 rounded-2xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-xl">Purge Record</button>
                       </div>
                     </div>
                     <div className="p-6 bg-zinc-900/60 backdrop-blur-sm">
                       <h4 className="font-orbitron font-bold text-sm uppercase truncate text-blue-400 tracking-tight">{item.name}</h4>
                       <p className="text-[9px] text-zinc-600 font-black uppercase mt-1 tracking-widest">{item.category} Dimension</p>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-12 text-center border-t border-zinc-900 text-zinc-700 text-[10px] font-bold uppercase tracking-[0.4em] bg-black/80 backdrop-blur-md">
        &copy; 2024 FOR THE COS. DIMENSIONS SYNERGIZED VIA GEMINI NEURAL PROCESSING.
      </footer>
    </div>
  );
};

export default App;