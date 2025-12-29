import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppStep, AppState, Category, Subcategory, CardStats, AdminSettings, SavedGeneration, ApiLog, PhysicalOrder } from './types';
import { CATEGORIES } from './constants';
import PhotoStep from './components/PhotoStep';
import Carousel from './components/Carousel';
import ComicFrame from './components/ComicFrame';
import TradingCard from './components/TradingCard';
import { processCosplayImage } from './services/gemini';
import { toPng } from 'html-to-image';
import { supabase, saveGeneration, getAllGenerations, deleteGeneration, logApiCall, getApiLogs, clearApiLogs, saveOrder, getAllOrders } from './services/db';

type ExportType = 'raw' | 'comic' | 'card-front' | 'card-back' | 'card-bundle';

const SESSION_ID = 'user-' + Math.random().toString(36).substring(2, 9);
const COST_PER_GENERATION = 0.015;
const ADMIN_EMAIL = "roarshackstudios@gmail.com";

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
      priceCardSet: 8.99
    };
  });

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'settings' | 'usage' | 'orders'>('settings');
  const [galleryItems, setGalleryItems] = useState<SavedGeneration[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [physicalOrders, setPhysicalOrders] = useState<PhysicalOrder[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [localMode, setLocalMode] = useState(!supabase);

  // Auth States
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [state, setState] = useState<AppState>({
    step: (supabase && !localMode) ? AppStep.LOGIN : AppStep.UPLOAD,
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
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setState(prev => ({ 
          ...prev, 
          currentUser: { id: session.user.id, email: session.user.email || '' }, 
          step: AppStep.UPLOAD 
        }));
      }
      setIsAuthLoading(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState(prev => ({ 
          ...prev, 
          currentUser: { id: session.user.id, email: session.user.email || '' },
          step: prev.step === AppStep.LOGIN || prev.step === AppStep.SIGNUP ? AppStep.UPLOAD : prev.step
        }));
      } else {
        setState(prev => ({ ...prev, currentUser: null, step: AppStep.LOGIN }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [isFlipped, setIsFlipped] = useState(false);
  const [activeExport, setActiveExport] = useState<ExportType | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Initializing systems...");
  
  const rawImageRef = useRef<HTMLDivElement>(null);
  const comicExportRef = useRef<HTMLDivElement>(null);
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);
  const cardBundleRef = useRef<HTMLDivElement>(null);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  
  const logoUrl = "https://i.ibb.co/b43T8dM/1.png";

  useEffect(() => {
    if (state.currentUser && supabase) {
      loadGallery();
      loadApiLogs();
      loadOrders();
    }
  }, [state.currentUser]);

  useEffect(() => {
    localStorage.setItem('cos-admin-settings', JSON.stringify(adminSettings));
  }, [adminSettings]);

  const loadGallery = async () => {
    if (!supabase) return;
    try {
      const items = await getAllGenerations();
      setGalleryItems(items);
    } catch (e) { console.error("Gallery failed", e); }
  };

  const loadApiLogs = async () => {
    if (!supabase) return;
    try {
      const logs = await getApiLogs();
      setApiLogs(logs);
    } catch (e) { console.error("Logs failed", e); }
  };

  const loadOrders = async () => {
    if (!supabase) return;
    try {
      const orders = await getAllOrders();
      setPhysicalOrders(orders);
    } catch (e) { console.error("Orders failed", e); }
  };

  const totalApiCost = useMemo(() => {
    return apiLogs.reduce((acc, log) => acc + log.cost, 0).toFixed(3);
  }, [apiLogs]);

  const isUserAdmin = useMemo(() => {
    return state.currentUser?.email.toLowerCase() === ADMIN_EMAIL;
  }, [state.currentUser]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.toLowerCase(),
      password: passwordInput,
    });
    if (error) setAuthError(error.message);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError('');
    if (!emailInput || !passwordInput) {
      setAuthError('Incomplete transmission. Email and password required.');
      return;
    }
    const { error } = await supabase.auth.signUp({
      email: emailInput.toLowerCase(),
      password: passwordInput,
    });
    if (error) setAuthError(error.message);
    else alert("Registration initialized. Check your email for verification.");
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const generateRandomStats = (): CardStats => ({
    strength: Math.floor(Math.random() * 6) + 2,
    intelligence: Math.floor(Math.random() * 6) + 2,
    energy: Math.floor(Math.random() * 6) + 2,
    mental: Math.floor(Math.random() * 6) + 2,
    fighting: Math.floor(Math.random() * 6) + 2,
    speed: Math.floor(Math.random() * 6) + 2,
  });

  const handlePhotoSelected = (base64: string) => {
    setState(prev => ({ ...prev, sourceImage: base64, step: AppStep.CATEGORY_SELECT, error: null, editingId: null }));
  };

  const handleCategorySelect = (category: Category) => {
    setState(prev => ({ 
      ...prev, 
      selectedCategory: category, 
      step: AppStep.SUBCATEGORY_SELECT,
      selectedSubcategory: null,
      error: null
    }));
  };

  const handleSubcategorySelect = (sub: Subcategory) => {
    setState(prev => ({ ...prev, selectedSubcategory: sub }));
  };

  const goBack = () => {
    if (state.error) {
       setState(prev => ({ ...prev, error: null, step: AppStep.UPLOAD, sourceImage: null }));
       return;
    }
    if (state.step === AppStep.CATEGORY_SELECT) {
      setState(prev => ({ ...prev, step: AppStep.UPLOAD, sourceImage: null }));
    } else if (state.step === AppStep.SUBCATEGORY_SELECT) {
      setState(prev => ({ ...prev, step: AppStep.CATEGORY_SELECT, selectedCategory: null, selectedSubcategory: null }));
    } else if (state.step === AppStep.RESULT) {
      if (state.editingId) {
        setState(prev => ({ ...prev, step: AppStep.GALLERY, editingId: null }));
      } else {
        setState(prev => ({ ...prev, step: AppStep.SUBCATEGORY_SELECT, resultImage: null, isComicStyled: false, isCardStyled: false, stats: null, resultScale: 1, resultOffset: { x: 0, y: 0 } }));
      }
    } else if (state.step === AppStep.GALLERY) {
      setState(prev => ({ ...prev, step: AppStep.UPLOAD }));
    }
  };

  const startProcessing = async () => {
    if (!state.sourceImage || !state.selectedCategory) return;
    if (state.selectedCategory.id === 'custom' && !state.customPrompt.trim()) {
      alert("Please describe your custom scene!");
      return;
    }

    setState(prev => ({ ...prev, step: AppStep.PROCESSING, error: null }));
    
    const messages = ["Analyzing character geometry...", "Synthesizing dimensions...", "Applying cinematic lighting...", "Polishing pixels..."];
    let msgIndex = 0;
    const interval = setInterval(() => {
      setLoadingMessage(messages[msgIndex % messages.length]);
      msgIndex++;
    }, 2500);

    const logEntry: ApiLog = {
      id: 'log-' + Date.now(),
      timestamp: Date.now(),
      userSession: SESSION_ID,
      model: 'gemini-2.5-flash-image',
      category: state.selectedCategory.name,
      subcategory: state.selectedSubcategory?.name || 'Custom',
      cost: COST_PER_GENERATION,
      status: 'success'
    };

    try {
      const result = await processCosplayImage(
        state.sourceImage,
        state.selectedCategory.name,
        state.selectedSubcategory?.name || "Auto Detect",
        state.styleIntensity,
        state.customPrompt
      );
      
      const initialName = state.selectedSubcategory?.name === 'Auto Detect' 
        ? `${adminSettings.defaultTitle} ${state.selectedCategory?.name}`
        : `${adminSettings.defaultTitle} ${state.selectedSubcategory?.name}`;

      setState(prev => ({ 
        ...prev, 
        resultImage: result, 
        step: AppStep.RESULT,
        stats: generateRandomStats(),
        characterName: initialName,
        characterDescription: adminSettings.defaultDescription
      }));
      
      await logApiCall(logEntry);
      loadApiLogs();
    } catch (err: any) {
      console.error(err);
      await logApiCall({ ...logEntry, status: 'error', cost: 0 });
      loadApiLogs();
      setState(prev => ({ 
        ...prev, 
        error: err.message || "Synthesis failure.",
        step: AppStep.UPLOAD 
      }));
    } finally {
      clearInterval(interval);
    }
  };

  const downloadResult = async (type: ExportType) => {
    if (!state.resultImage || activeExport) return;
    setActiveExport(type);

    // Using strictly typed Options to avoid TS2353
    const exportOptions = {
      pixelRatio: 2,
      backgroundColor: '#000000',
      cacheBust: true,
      skipFonts: false
    } as any;

    try {
      let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
      let fileName = `cosplay_artifact_${Date.now()}.png`;

      switch (type) {
        case 'raw': targetRef = rawImageRef; break;
        case 'comic': targetRef = comicExportRef; break;
        case 'card-front': targetRef = cardFrontRef; break;
        case 'card-back': targetRef = cardBackRef; break;
      }

      if (targetRef?.current) {
        const imgs = targetRef.current.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map((img: any) => {
          const image = img as HTMLImageElement;
          if (image.complete) return Promise.resolve();
          return new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
        }));

        await new Promise(r => setTimeout(r, 600));
        const dataUrl = await toPng(targetRef.current, exportOptions);
        
        if (supabase && state.currentUser) {
          const genId = state.editingId || `gen-${Date.now()}`;
          await saveGeneration({
            id: genId,
            timestamp: Date.now(),
            image: dataUrl,
            name: state.characterName,
            category: state.selectedCategory?.name || 'Unknown',
            type: state.isComicStyled ? 'comic' : (state.isCardStyled ? 'card' : 'raw'),
            stats: state.stats || undefined,
            description: state.characterDescription,
            cardStatusText: state.isCardStyled ? state.cardStatusText : undefined,
            originalSourceImage: state.sourceImage || undefined
          });
          loadGallery();
        }

        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Export failed:", err);
      setState(prev => ({ ...prev, error: "Artifact storage failure." }));
    } finally {
      setActiveExport(null);
    }
  };

  const saveToHistoryOnly = async () => {
    if (!state.resultImage || isSaving) return;
    setIsSaving(true);

    if (!supabase || !state.currentUser) {
      alert("Local Mode: Synchronization is disabled. Your artifacts will not be saved to the cloud archives.");
      setIsSaving(false);
      return;
    }

    try {
      let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
      if (state.isComicStyled) targetRef = comicExportRef;
      else if (state.isCardStyled) targetRef = cardFrontRef;
      else targetRef = rawImageRef;

      if (targetRef?.current) {
        const imgs = targetRef.current.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map((img: any) => {
          const image = img as HTMLImageElement;
          if (image.complete) return Promise.resolve();
          return new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
        }));

        await new Promise(r => setTimeout(r, 400));
        const dataUrl = await toPng(targetRef.current, { pixelRatio: 1.5, cacheBust: true } as any);
        
        const genId = state.editingId || `gen-${Date.now()}`;
        await saveGeneration({
          id: genId,
          timestamp: Date.now(),
          image: dataUrl,
          name: state.characterName,
          category: state.selectedCategory?.name || 'Unknown',
          type: state.isComicStyled ? 'comic' : (state.isCardStyled ? 'card' : 'raw'),
          stats: state.stats || undefined,
          description: state.characterDescription,
          cardStatusText: state.isCardStyled ? state.cardStatusText : undefined,
          originalSourceImage: state.sourceImage || undefined
        });
        await loadGallery();
        alert("Chronicle successfully synced with cloud archives.");
      }
    } catch (err: any) {
      console.error("Save to history failed:", err);
      // More descriptive alerting for troubleshooting
      if (err.message.includes("PERMISSIONS ERROR")) {
        alert(err.message);
      } else {
        alert(`Sync failure: ${err.message || "Unknown error."}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGalleryItem = (item: SavedGeneration) => {
    const cat = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[1];
    setState(prev => ({
      ...prev,
      step: AppStep.RESULT,
      sourceImage: item.originalSourceImage || null,
      selectedCategory: cat,
      selectedSubcategory: cat.subcategories?.[0] || null,
      resultImage: item.image,
      isComicStyled: item.type === 'comic',
      isCardStyled: item.type === 'card',
      stats: item.stats || generateRandomStats(),
      characterName: item.name,
      characterDescription: item.description || '',
      cardStatusText: item.cardStatusText || 'PREMIUM COLLECTOR',
      editingId: item.id
    }));
  };

  const deleteItem = async (id: string) => {
    if (confirm("Erase this artifact from the archives?")) {
      await deleteGeneration(id);
      loadGallery();
    }
  };

  const handleScaleChange = (val: number) => setState(prev => ({ ...prev, resultScale: val }));
  const handleOffsetChange = (axis: 'x' | 'y', val: number) => setState(prev => ({ ...prev, resultOffset: { ...prev.resultOffset, [axis]: val } }));

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center space-y-4">
        <img src={logoUrl} className="w-20 h-20 animate-pulse" alt="Loading" />
        <p className="font-orbitron font-bold text-xs uppercase tracking-widest text-zinc-500">Decrypting Gate Access...</p>
      </div>
    );
  }

  // SYSTEM DIAGNOSTICS SCREEN (Supabase Offline)
  if (!supabase && !localMode) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center space-y-12 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse"></div>
          <div className="w-32 h-32 bg-zinc-900 border-2 border-red-500/50 rounded-full flex items-center justify-center text-red-500 text-5xl shadow-[0_0_50px_rgba(239,68,68,0.3)] relative z-10">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>
        
        <div className="space-y-4 max-w-2xl relative z-10">
          <h1 className="text-5xl font-orbitron font-black uppercase tracking-tighter italic leading-none">
            Dimension <span className="text-red-500">Offline</span>
          </h1>
          <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-[10px] leading-relaxed">
            The Dimensional Gate requires a valid Supabase Linkage to manifest the cloud chronicles.
          </p>
        </div>

        <div className="w-full max-w-lg bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-10 text-left space-y-8 backdrop-blur-xl relative z-10">
          <div className="flex items-center space-x-4 border-b border-zinc-800 pb-6">
             <i className="fa-solid fa-wrench text-blue-500 text-xl"></i>
             <h2 className="text-xs font-black uppercase tracking-[0.3em] text-white italic">Setup Protocol</h2>
          </div>
          
          <ul className="space-y-6">
            <li className="flex items-start space-x-4 group">
              <div className="w-6 h-6 rounded-full bg-blue-600/10 border border-blue-500 flex items-center justify-center text-[10px] font-black text-blue-500 mt-1 shadow-[0_0_10px_rgba(59,130,246,0.2)]">1</div>
              <div className="space-y-1">
                <p className="text-sm text-white font-bold uppercase tracking-tight">Configure Environment</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Add SUPABASE_URL and SUPABASE_ANON_KEY to your project secrets to enable cloud saving.</p>
              </div>
            </li>
          </ul>

          <div className="pt-4 flex flex-col space-y-3">
             <button onClick={() => setLocalMode(true)} className="block w-full py-4 bg-blue-600 hover:bg-blue-500 text-white text-center font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-lg glow-effect">
               Proceed in Local Mode (Guest)
             </button>
             <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="block w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white text-center font-black uppercase tracking-widest text-[10px] rounded-2xl border border-zinc-700 transition-all">
               Open Supabase Dashboard
             </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-inter">
      {/* AUTH SCREENS */}
      {(state.step === AppStep.LOGIN || state.step === AppStep.SIGNUP) && supabase && (
        <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center p-6 overflow-y-auto">
          <div className="max-w-md w-full space-y-8 animate-fade-in text-center">
            <div className="space-y-4">
              <img src={logoUrl} className="w-24 h-24 mx-auto object-contain glow-effect rounded-full bg-white/5 p-4" alt="Logo" />
              <h1 className="text-4xl font-orbitron font-black uppercase tracking-tighter italic">Dimensional <span className="text-blue-500">Gate</span></h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{state.step === AppStep.LOGIN ? 'Verify Identity' : 'Register Bio-Data'}</p>
            </div>
            <form onSubmit={state.step === AppStep.LOGIN ? handleLogin : handleSignup} className="space-y-4 bg-zinc-900/50 p-8 rounded-[2rem] border border-zinc-800 backdrop-blur-xl">
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none" placeholder="Email Address" />
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white outline-none" placeholder="Cipher Key" />
              {authError && <p className="text-red-500 text-[10px] font-bold uppercase">{authError}</p>}
              <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg glow-effect">Enter Portal</button>
            </form>
            <div className="flex flex-col space-y-4">
              <button onClick={() => { setState(prev => ({ ...prev, step: prev.step === AppStep.LOGIN ? AppStep.SIGNUP : AppStep.LOGIN })); setAuthError(''); }} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">
                {state.step === AppStep.LOGIN ? "New Identity? Create Bio-ID" : "Existing Identity? Return to Gate"}
              </button>
              <button onClick={() => setLocalMode(true)} className="text-blue-500/50 hover:text-blue-500 text-[10px] font-black uppercase tracking-widest transition-all">Skip and Use Local Mode</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="px-6 py-2 flex justify-between items-center border-b border-zinc-900 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center cursor-pointer group" onClick={() => { setState(prev => ({ ...prev, step: AppStep.UPLOAD, sourceImage: null, resultImage: null, error: null, editingId: null })); }}>
          <img src={logoUrl} className="w-[100px] h-[100px] object-contain" alt="Logo" />
          <h1 className="text-2xl font-orbitron font-bold tracking-tighter uppercase ml-4">FOR THE <span className="text-blue-500">COS</span></h1>
        </div>
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex items-center space-x-2 mr-4">
             <div className={`w-2 h-2 rounded-full ${supabase ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
             <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{supabase ? 'Sync Online' : 'Local Node'}</span>
          </div>
          {state.currentUser ? (
            <>
              <button onClick={() => setState(prev => ({ ...prev, step: AppStep.GALLERY }))} className={`text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-2 ${state.step === AppStep.GALLERY ? 'text-blue-500' : 'text-zinc-500 hover:text-white'}`}>
                <i className="fa-solid fa-layer-group"></i><span className="hidden md:inline">Gallery</span>
              </button>
              <button onClick={handleLogout} className="text-zinc-500 hover:text-red-500 transition-colors"><i className="fa-solid fa-power-off"></i></button>
            </>
          ) : (
            supabase && <button onClick={() => setLocalMode(false)} className="text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all">Login</button>
          )}
          
          {(state.step !== AppStep.UPLOAD) && state.step !== AppStep.PROCESSING && state.step !== AppStep.GALLERY && (
            <button onClick={goBack} className="px-6 py-2 bg-zinc-900 rounded-full border border-zinc-800 flex items-center space-x-2 text-zinc-400 hover:text-white">
              <i className="fa-solid fa-arrow-left text-xs"></i><span className="text-sm font-bold uppercase tracking-widest">Back</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col justify-center">
        {state.step === AppStep.UPLOAD && <PhotoStep onPhotoSelected={handlePhotoSelected} />}
        {state.step === AppStep.CATEGORY_SELECT && <div className="py-12"><Carousel items={CATEGORIES} onItemSelect={handleCategorySelect} title="SELECT YOUR REALITY" /></div>}
        {state.step === AppStep.SUBCATEGORY_SELECT && (
          <div className="py-12 space-y-12">
            {state.selectedCategory?.id === 'custom' ? (
              <div className="max-w-2xl mx-auto px-6 space-y-8">
                <h2 className="text-4xl font-orbitron font-bold text-blue-400 tracking-wider text-center uppercase">Manifest Destiny</h2>
                <textarea value={state.customPrompt} onChange={(e) => setState(prev => ({ ...prev, customPrompt: e.target.value }))} placeholder="Describe the specific world you want to step into..." className="w-full h-48 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 text-white outline-none" />
                <button onClick={startProcessing} className="w-full py-4 bg-blue-600 rounded-full font-bold shadow-lg glow-effect">GENERATE</button>
              </div>
            ) : (
              <Carousel items={state.selectedCategory?.subcategories || []} onItemSelect={handleSubcategorySelect} title={`${state.selectedCategory?.name.toUpperCase()} DOMAINS`} isSubView={true} onBack={goBack} onConfirm={startProcessing} selectedIndex={state.selectedCategory?.subcategories?.findIndex(s => s.id === state.selectedSubcategory?.id)} />
            )}
          </div>
        )}
        {state.step === AppStep.PROCESSING && (
          <div className="flex flex-col items-center justify-center space-y-12 p-12">
            <img src={logoUrl} className="w-20 h-20 animate-bounce" alt="logo" />
            <h2 className="text-3xl font-orbitron font-bold text-blue-500 animate-pulse uppercase">Dimension Hopping</h2>
            <p className="text-zinc-500 font-mono tracking-widest uppercase">{loadingMessage}</p>
          </div>
        )}
        {state.step === AppStep.RESULT && state.resultImage && (
          <div className="p-6 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-12 items-start justify-center">
            {/* Hidden export targets */}
            <div className="absolute left-[-9999px] top-0 overflow-hidden" style={{ width: '4000px', height: '4000px' }}>
              <div ref={rawImageRef} style={{ width: '768px', height: '1024px' }}><img src={state.resultImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
              <div ref={comicExportRef} style={{ width: '800px', height: '1200px', position: 'relative' }}>
                <img src={state.resultImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <ComicFrame category={state.selectedCategory?.name || "HERO"} subcategory={state.selectedSubcategory?.name || "ULTIMATE"} customTitle={state.characterName} />
              </div>
              <div ref={cardFrontRef} style={{ width: '900px', height: '1200px' }}><TradingCard frontImage={state.resultImage} backImage={state.sourceImage!} stats={state.stats!} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={false} onFlip={() => {}} statusText={state.cardStatusText} exportSide="front" /></div>
              <div ref={cardBackRef} style={{ width: '900px', height: '1200px' }}><TradingCard frontImage={state.resultImage} backImage={state.sourceImage!} stats={state.stats!} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={true} onFlip={() => {}} statusText={state.cardStatusText} exportSide="back" /></div>
            </div>

            <div className="flex-1 w-full max-w-lg mx-auto space-y-4">
              <div className={`relative group rounded-3xl overflow-hidden border-[10px] border-black bg-black transition-all ${state.isComicStyled ? 'aspect-[2/3]' : 'aspect-[3/4]'}`}>
                  {state.isComicStyled ? (
                    <div className="w-full h-full relative">
                      <img src={state.resultImage} className="w-full h-full object-cover" style={{ transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                      <ComicFrame category={state.selectedCategory?.name || "HERO"} subcategory={state.selectedSubcategory?.name || "ULTIMATE"} customTitle={state.characterName} />
                    </div>
                  ) : state.isCardStyled ? (
                    <TradingCard frontImage={state.resultImage} backImage={state.sourceImage!} stats={state.stats!} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} statusText={state.cardStatusText} imageScale={state.resultScale} imageOffset={state.resultOffset} />
                  ) : (
                    <img src={state.resultImage} className="w-full h-full object-cover" />
                  )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadResult('raw')} className="flex-1 py-3 bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest">Base PNG</button>
                {state.isComicStyled && <button onClick={() => downloadResult('comic')} className="flex-1 py-3 bg-yellow-600 rounded-xl text-xs font-bold uppercase tracking-widest">Comic Cover</button>}
                {state.isCardStyled && <button onClick={() => downloadResult('card-front')} className="flex-1 py-3 bg-blue-600 rounded-xl text-xs font-bold uppercase tracking-widest">Card Artifact</button>}
              </div>
            </div>

            <div className="w-full lg:w-96 space-y-6">
              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-md space-y-4">
                <h3 className="font-orbitron font-black text-xl text-blue-500 italic uppercase">IDENTITY MATRIX</h3>
                <input type="text" value={state.characterName} onChange={(e) => setState(prev => ({ ...prev, characterName: e.target.value }))} className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none" placeholder="Name" />
                <textarea value={state.characterDescription} onChange={(e) => setState(prev => ({ ...prev, characterDescription: e.target.value }))} className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none h-24 resize-none" placeholder="Bio" />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setState(prev => ({ ...prev, isComicStyled: !prev.isComicStyled, isCardStyled: false }))} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 ${state.isComicStyled ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-zinc-800 border-zinc-700'}`}>Comic Style</button>
                  <button onClick={() => setState(prev => ({ ...prev, isCardStyled: !prev.isCardStyled, isComicStyled: false }))} className={`py-3 rounded-xl font-black text-[10px] uppercase border-2 ${state.isCardStyled ? 'bg-blue-600 text-white border-blue-400' : 'bg-zinc-800 border-zinc-700'}`}>Card Style</button>
                </div>
                <button onClick={saveToHistoryOnly} disabled={isSaving} className="w-full py-4 bg-white text-black rounded-full font-black uppercase tracking-widest flex items-center justify-center space-x-2 hover:bg-blue-500 hover:text-white transition-all">
                  {isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                  <span>{isSaving ? 'Syncing...' : 'Sync to Chronicles'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {state.step === AppStep.GALLERY && (
          <div className="p-8 max-w-7xl mx-auto w-full space-y-12">
             <div className="flex justify-between items-end border-b border-zinc-900 pb-6">
               <h2 className="text-5xl font-orbitron font-black italic uppercase text-white">The Archives</h2>
               <button onClick={() => setState(prev => ({ ...prev, step: AppStep.UPLOAD }))} className="bg-blue-600 px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs">New World</button>
             </div>
             {galleryItems.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-30">
                 <i className="fa-solid fa-box-archive text-5xl"></i>
                 <p className="font-orbitron font-bold uppercase tracking-widest">No cloud artifacts found</p>
                 {localMode && <p className="text-[10px] max-w-xs text-center uppercase tracking-tighter">Note: Chronicles are only available when cloud synchronization is active.</p>}
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {galleryItems.map(item => (
                  <div key={item.id} className="bg-zinc-900/40 rounded-3xl border border-zinc-800/50 overflow-hidden group hover:border-blue-500/50 transition-all">
                      <div className="aspect-[3/4] relative bg-black overflow-hidden">
                        <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 space-y-3 px-6">
                            <button onClick={() => handleEditGalleryItem(item)} className="w-full py-3 bg-white text-black rounded-xl font-black uppercase text-[10px]">Edit Artifact</button>
                            <button onClick={() => deleteItem(item.id)} className="w-full py-3 bg-red-600/20 text-red-500 border border-red-500/50 rounded-xl font-black uppercase text-[10px]">Erase</button>
                        </div>
                      </div>
                      <div className="p-5"><h4 className="font-orbitron font-bold text-sm uppercase truncate">{item.name}</h4><p className="text-[10px] text-zinc-500 uppercase">{item.category} Matrix</p></div>
                  </div>
                ))}
              </div>
             )}
          </div>
        )}
      </main>
      <footer className="py-8 text-center border-t border-zinc-900 text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">&copy; 2024 FOR THE COS. DIMENSIONS SYNERGIZED VIA GEMINI AI.</footer>
    </div>
  );
};

export default App;