import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppStep, AppState, Category, Subcategory, CardStats, AdminSettings, SavedGeneration, ApiLog, PhysicalOrder, User } from './types';
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

  // Auth States
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [state, setState] = useState<AppState>({
    step: AppStep.LOGIN,
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
    else alert("Identity registration initialized. Check your email for verification.");
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  // PayPal Script Injection
  useEffect(() => {
    if (isCheckoutOpen) {
      const clientId = adminSettings.isPaypalProduction 
        ? adminSettings.paypalClientIdProduction 
        : adminSettings.paypalClientIdSandbox;

      if (!clientId || clientId === 'test') return;

      const scriptId = 'paypal-sdk-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      if (script) {
        script.remove();
      }

      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.onload = () => initPaypalButtons();
      document.body.appendChild(script);
    }
  }, [isCheckoutOpen, adminSettings.isPaypalProduction]);

  const initPaypalButtons = () => {
    if ((window as any).paypal && paypalContainerRef.current) {
      paypalContainerRef.current.innerHTML = '';
      const price = state.isComicStyled ? adminSettings.priceComicPrint : adminSettings.priceCardSet;
      const type = state.isComicStyled ? 'comic' : 'card';

      (window as any).paypal.Buttons({
        createOrder: (data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: price.toString(),
                currency_code: 'USD'
              },
              description: `Premium Print: ${state.characterName} (${type.toUpperCase()})`
            }]
          });
        },
        onApprove: async (data: any, actions: any) => {
          const details = await actions.order.capture();
          handlePaymentSuccess(details);
        },
        onError: (err: any) => {
          console.error("PayPal Error:", err);
          alert("Payment could not be processed at this time.");
        }
      }).render(paypalContainerRef.current);
    }
  };

  const handlePaymentSuccess = async (details: any) => {
    const order: PhysicalOrder = {
      id: `ord-${Date.now()}`,
      timestamp: Date.now(),
      paypalOrderId: details.id,
      itemType: state.isComicStyled ? 'comic' : 'card',
      itemName: state.characterName,
      amount: state.isComicStyled ? adminSettings.priceComicPrint : adminSettings.priceCardSet,
      status: 'paid',
      previewImage: state.resultImage || ''
    };

    await saveOrder(order);
    loadOrders();
    setOrderSuccess(true);
    setTimeout(() => {
      setOrderSuccess(false);
      setIsCheckoutOpen(false);
    }, 4000);
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
      alert("Please tell us about your scene!");
      return;
    }

    setState(prev => ({ ...prev, step: AppStep.PROCESSING, error: null }));
    
    const messages = [
      "Analyzing character geometry...",
      "Synthesizing background particles...",
      "Applying cinematic lighting passes...",
      "Merging dimensions...",
      "Polishing temporal pixels...",
      "Finalizing masterpiece..."
    ];
    
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
        error: err.message || "A distortion in the reality shift occurred. The image could not be synthesized.",
        step: AppStep.UPLOAD 
      }));
    } finally {
      clearInterval(interval);
    }
  };

  const downloadResult = async (type: ExportType) => {
    if (!state.resultImage || activeExport) return;
    setActiveExport(type);

    const exportOptions = {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#000000',
    };

    try {
      let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
      let fileName = `cosplay_artifact_${Date.now()}.png`;

      switch (type) {
        case 'raw': targetRef = rawImageRef; fileName = `cosplay_raw_${Date.now()}.png`; break;
        case 'comic': targetRef = comicExportRef; fileName = `cosplay_comic_cover_${Date.now()}.png`; break;
        case 'card-front': targetRef = cardFrontRef; fileName = `cosplay_card_front_${Date.now()}.png`; break;
        case 'card-back': targetRef = cardBackRef; fileName = `cosplay_card_back_${Date.now()}.png`; break;
        case 'card-bundle': targetRef = cardBundleRef; fileName = `cosplay_card_bundle_${Date.now()}.png`; break;
      }

      if (targetRef?.current) {
        const imgs = targetRef.current.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map(img => {
          const image = img as HTMLImageElement;
          if (image.complete) return Promise.resolve();
          return new Promise(resolve => { 
            image.onload = resolve; 
            image.onerror = resolve; 
          });
        }));

        await new Promise(r => setTimeout(r, 600));
        const dataUrl = await toPng(targetRef.current, exportOptions);
        
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

        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Export failed:", err);
      setState(prev => ({ ...prev, error: "Artifact storage failure. Check system health." }));
    } finally {
      setActiveExport(null);
    }
  };

  const saveToHistoryOnly = async () => {
    if (!state.resultImage || isSaving) return;
    setIsSaving(true);

    try {
      let targetRef: React.RefObject<HTMLDivElement | null> | null = null;
      if (state.isComicStyled) targetRef = comicExportRef;
      else if (state.isCardStyled) targetRef = cardFrontRef;
      else targetRef = rawImageRef;

      if (targetRef?.current) {
        const imgs = targetRef.current.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map(img => {
          const image = img as HTMLImageElement;
          if (image.complete) return Promise.resolve();
          return new Promise(resolve => { 
            image.onload = resolve; 
            image.onerror = resolve; 
          });
        }));

        await new Promise(r => setTimeout(r, 400));
        const dataUrl = await toPng(targetRef.current, { pixelRatio: 1.5, cacheBust: true });
        
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
        alert("Chronicle successfully synchronized with cloud archives.");
      }
    } catch (err) {
      console.error("Save to history failed:", err);
      alert("Failed to sync artifact. Storage full or offline.");
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
      customPrompt: '',
      resultImage: item.image,
      isComicStyled: item.type === 'comic',
      isCardStyled: item.type === 'card',
      stats: item.stats || generateRandomStats(),
      characterName: item.name,
      characterDescription: item.description || '',
      cardStatusText: item.cardStatusText || 'PREMIUM COLLECTOR',
      styleIntensity: 80,
      resultScale: 1,
      resultOffset: { x: 0, y: 0 },
      error: null,
      editingId: item.id
    }));
  };

  const deleteItem = async (id: string) => {
    if (confirm("Permanently erase this artifact from the cloud chronicles?")) {
      await deleteGeneration(id);
      loadGallery();
    }
  };

  const handleClearLogs = async () => {
    if (confirm("Purge all API transaction history? This cannot be undone.")) {
      await clearApiLogs();
      loadApiLogs();
    }
  };

  const toggleComicStyle = () => {
    setState(prev => ({ ...prev, isComicStyled: !prev.isComicStyled, isCardStyled: false }));
  };

  const toggleCardStyle = () => {
    setState(prev => ({ ...prev, isCardStyled: !prev.isCardStyled, isComicStyled: false }));
    setIsFlipped(false);
  };

  const handleScaleChange = (val: number) => {
    setState(prev => ({ ...prev, resultScale: val }));
  };

  const handleOffsetChange = (axis: 'x' | 'y', val: number) => {
    setState(prev => ({ 
      ...prev, 
      resultOffset: { ...prev.resultOffset, [axis]: val } 
    }));
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center space-y-4">
        <img src={logoUrl} className="w-20 h-20 animate-pulse" alt="Loading" />
        <p className="font-orbitron font-bold text-xs uppercase tracking-widest text-zinc-500">Decrypting Gate Access...</p>
      </div>
    );
  }

  // SYSTEM DIAGNOSTICS SCREEN (Missing Supabase Config)
  if (!supabase) {
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
            The Dimensional Gate requires a valid Supabase Linkage to manifest the chronicles.
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
                <p className="text-sm text-white font-bold uppercase tracking-tight">Access the Secrets Tab</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Find the &quot;Secrets&quot; or &quot;Environment Variables&quot; panel in your code editor&apos;s sidebar.</p>
              </div>
            </li>
            <li className="flex items-start space-x-4 group">
              <div className="w-6 h-6 rounded-full bg-blue-600/10 border border-blue-500 flex items-center justify-center text-[10px] font-black text-blue-500 mt-1">2</div>
              <div className="space-y-1">
                <p className="text-sm text-white font-bold uppercase tracking-tight">Configure SUPABASE_URL</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Copy the &quot;Project URL&quot; from Supabase Settings &gt; API and add it as a new secret.</p>
              </div>
            </li>
            <li className="flex items-start space-x-4 group">
              <div className="w-6 h-6 rounded-full bg-blue-600/10 border border-blue-500 flex items-center justify-center text-[10px] font-black text-blue-500 mt-1">3</div>
              <div className="space-y-1">
                <p className="text-sm text-white font-bold uppercase tracking-tight">Configure SUPABASE_ANON_KEY</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Copy the &quot;anon&quot; public key from Supabase Settings &gt; API and add it as a new secret.</p>
              </div>
            </li>
          </ul>

          <div className="pt-4">
             <a href="https://supabase.com" target="_blank" className="block w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white text-center font-black uppercase tracking-widest text-[10px] rounded-2xl border border-zinc-700 transition-all">
               Open Supabase Dashboard
             </a>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-zinc-600 animate-pulse">
           <i className="fa-solid fa-circle-notch animate-spin"></i>
           <p className="text-[10px] uppercase font-black tracking-widest">Awaiting Pulse Connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-inter">
      
      {/* AUTH SCREENS */}
      {(state.step === AppStep.LOGIN || state.step === AppStep.SIGNUP) && (
        <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center p-6 overflow-y-auto">
          <div className="max-w-md w-full space-y-8 animate-fade-in text-center">
            <div className="space-y-4">
              <img src={logoUrl} className="w-24 h-24 mx-auto object-contain glow-effect rounded-full bg-white/5 p-4" alt="Logo" />
              <h1 className="text-4xl font-orbitron font-black uppercase tracking-tighter italic">Dimensional <span className="text-blue-500">Gate</span></h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{state.step === AppStep.LOGIN ? 'Verify Identity to Enter Chronicles' : 'Register Bio-Data for Access'}</p>
            </div>

            <form onSubmit={state.step === AppStep.LOGIN ? handleLogin : handleSignup} className="space-y-4 bg-zinc-900/50 p-8 rounded-[2rem] border border-zinc-800 backdrop-blur-xl">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block text-left ml-2">Neural Email Address</label>
                <input 
                  type="email" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="subject@roarshack.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block text-left ml-2">Access Cipher</label>
                <input 
                  type="password" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {authError && (
                <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 p-3 rounded-xl border border-red-500/20">{authError}</p>
              )}

              <button 
                type="submit"
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg glow-effect active:scale-95"
              >
                {state.step === AppStep.LOGIN ? 'Authorize Access' : 'Register Identity'}
              </button>
            </form>

            <div className="pt-4">
               {state.step === AppStep.LOGIN ? (
                 <button onClick={() => { setState(prev => ({ ...prev, step: AppStep.SIGNUP })); setAuthError(''); }} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">New Subject? Register Bio-ID</button>
               ) : (
                 <button onClick={() => { setState(prev => ({ ...prev, step: AppStep.LOGIN })); setAuthError(''); }} className="text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">Identity Exists? Return to Gate</button>
               )}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl animate-fade-in">
          <div className="max-w-xl w-full bg-[#111] border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
            {orderSuccess && (
              <div className="absolute inset-0 bg-blue-600 z-10 flex flex-col items-center justify-center space-y-4 animate-fade-in">
                 <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-blue-600 text-4xl animate-bounce">
                    <i className="fa-solid fa-check"></i>
                 </div>
                 <h2 className="text-3xl font-orbitron font-black italic uppercase">Order Manifested!</h2>
                 <p className="text-white/80 font-bold uppercase tracking-widest text-xs">Payment captured. Shipping protocols initialized.</p>
              </div>
            )}

            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-all">
              <i className="fa-solid fa-times text-xl"></i>
            </button>

            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                 <div className="w-12 h-12 bg-blue-600/10 border border-blue-500 rounded-2xl flex items-center justify-center text-blue-500">
                    <i className={`fa-solid ${state.isComicStyled ? 'fa-book-open' : 'fa-address-card'} text-xl`}></i>
                 </div>
                 <div>
                   <h2 className="text-xl font-orbitron font-bold uppercase italic tracking-tighter">Order Physical Archive</h2>
                   <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Premium Glossy Finish • 11&quot; x 17&quot; • Free Shipping</p>
                 </div>
              </div>

              <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 flex items-center space-x-6">
                 <img src={state.resultImage || ''} className="w-24 h-32 object-cover rounded-lg border border-zinc-700 shadow-xl" alt="Preview" />
                 <div className="space-y-1">
                    <h3 className="font-orbitron font-bold uppercase tracking-tighter">{state.characterName}</h3>
                    <p className="text-zinc-500 text-xs italic line-clamp-2">{state.characterDescription}</p>
                    <div className="pt-2 text-2xl font-black font-orbitron text-white">
                      ${state.isComicStyled ? adminSettings.priceComicPrint : adminSettings.priceCardSet}
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 italic">Payment Protocol</span>
                   <div className="flex items-center space-x-2">
                     <i className="fa-brands fa-paypal text-blue-400"></i>
                     <span className="text-[10px] font-black uppercase text-blue-400">Secure Checkout</span>
                   </div>
                </div>
                
                {/* PayPal Target */}
                <div className="min-h-[150px] relative">
                   {(!adminSettings.isPaypalProduction && adminSettings.paypalClientIdSandbox === 'test') || (adminSettings.isPaypalProduction && !adminSettings.paypalClientIdProduction) ? (
                     <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl text-center space-y-2">
                        <i className="fa-solid fa-triangle-exclamation text-red-500 text-2xl"></i>
                        <p className="text-xs text-red-400 font-bold uppercase tracking-widest leading-relaxed">System offline. Administrative setup required for financial transactions.</p>
                     </div>
                   ) : (
                     <div ref={paypalContainerRef} className="z-0"></div>
                   )}
                </div>
              </div>

              <p className="text-[8px] text-zinc-600 text-center uppercase font-bold tracking-widest leading-relaxed">By proceeding, you authorize the dimension shift of a physical artifact to your localized geographic sector.</p>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PANEL MODAL */}
      {isAdminOpen && isUserAdmin && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-4xl bg-[#0d0d0d] border border-zinc-800 rounded-[2.5rem] overflow-hidden flex flex-col h-[80vh] shadow-2xl">
            <div className="px-8 py-6 border-b border-zinc-800 flex justify-between items-center bg-black/40">
              <div className="flex items-center space-x-4">
                <i className="fa-solid fa-gauge-high text-blue-500"></i>
                <h2 className="text-xl font-orbitron font-bold uppercase tracking-tighter italic">Operational Dashboard</h2>
              </div>
              <button onClick={() => setIsAdminOpen(false)} className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center transition-all">
                <i className="fa-solid fa-times"></i>
              </button>
            </div>

            <div className="flex border-b border-zinc-800 bg-black/20">
              <button 
                onClick={() => setAdminTab('settings')}
                className={`flex-1 py-4 font-bold uppercase tracking-widest text-xs transition-all ${adminTab === 'settings' ? 'bg-blue-600/10 text-blue-500 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-white'}`}
              >
                Global Parameters
              </button>
              <button 
                onClick={() => setAdminTab('orders')}
                className={`flex-1 py-4 font-bold uppercase tracking-widest text-xs transition-all ${adminTab === 'orders' ? 'bg-blue-600/10 text-blue-500 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-white'}`}
              >
                Order Manifest
              </button>
              <button 
                onClick={() => setAdminTab('usage')}
                className={`flex-1 py-4 font-bold uppercase tracking-widest text-xs transition-all ${adminTab === 'usage' ? 'bg-blue-600/10 text-blue-500 border-b-2 border-blue-500' : 'text-zinc-500 hover:text-white'}`}
              >
                Temporal Metrics
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 no-scrollbar">
              {adminTab === 'settings' ? (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase text-blue-500 tracking-[0.2em] italic border-l-2 border-blue-500 pl-4 mb-4">Financial Settings (PayPal)</h3>
                      
                      <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Production Mode</span>
                        <button 
                          onClick={() => setAdminSettings(prev => ({ ...prev, isPaypalProduction: !prev.isPaypalProduction }))}
                          className={`w-12 h-6 rounded-full transition-all relative ${adminSettings.isPaypalProduction ? 'bg-blue-600' : 'bg-zinc-700'}`}
                        >
                           <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${adminSettings.isPaypalProduction ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sandbox Client ID</label>
                        <input 
                          type="text" 
                          value={adminSettings.paypalClientIdSandbox}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, paypalClientIdSandbox: e.target.value }))}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Production Client ID</label>
                        <input 
                          type="text" 
                          placeholder="Client ID from PayPal Developer Portal"
                          value={adminSettings.paypalClientIdProduction}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, paypalClientIdProduction: e.target.value }))}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-mono text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Comic Price ($)</label>
                          <input 
                            type="number" step="0.01"
                            value={adminSettings.priceComicPrint}
                            onChange={(e) => setAdminSettings(prev => ({ ...prev, priceComicPrint: parseFloat(e.target.value) }))}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Card Price ($)</label>
                          <input 
                            type="number" step="0.01"
                            value={adminSettings.priceCardSet}
                            onChange={(e) => setAdminSettings(prev => ({ ...prev, priceCardSet: parseFloat(e.target.value) }))}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xs font-black uppercase text-purple-500 tracking-[0.2em] italic border-l-2 border-purple-500 pl-4 mb-4">Content Parameters</h3>
                      
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Archetype Title Placeholder</label>
                        <input 
                          type="text" 
                          value={adminSettings.defaultTitle}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, defaultTitle: e.target.value }))}
                          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Narrative Generator Placeholder</label>
                        <textarea 
                          value={adminSettings.defaultDescription}
                          onChange={(e) => setAdminSettings(prev => ({ ...prev, defaultDescription: e.target.value }))}
                          className="w-full h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all resize-none text-xs leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : adminTab === 'orders' ? (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex justify-between items-center px-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 italic">Historical Order Manifest</h3>
                    <span className="text-[10px] font-bold uppercase text-blue-500">{physicalOrders.length} Artifacts Dispatched</span>
                  </div>
                  <div className="space-y-3">
                    {physicalOrders.map(order => (
                      <div key={order.id} className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
                         <div className="flex items-center space-x-4">
                            <img src={order.previewImage} className="w-12 h-16 object-cover rounded-md border border-zinc-800" alt="Order Preview" />
                            <div className="flex flex-col">
                              <span className="text-white font-black uppercase text-sm italic">{order.itemName}</span>
                              <span className="text-zinc-600 text-[9px] font-mono mt-0.5">Order: {order.paypalOrderId} • {new Date(order.timestamp).toLocaleString()}</span>
                            </div>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-white font-orbitron font-black text-sm">${order.amount}</span>
                            <span className="bg-green-600/10 text-green-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase mt-1">Status: Paid</span>
                         </div>
                      </div>
                    ))}
                    {physicalOrders.length === 0 && (
                      <div className="text-center py-20 text-zinc-700 italic text-sm">No physical artifacts have been Manifested in this session.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 text-center">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">Total Cycles</div>
                      <div className="text-3xl font-orbitron font-black italic">{apiLogs.length}</div>
                    </div>
                    <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 text-center">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">Resource Cost</div>
                      <div className="text-3xl font-orbitron font-black italic text-green-500">${totalApiCost}</div>
                    </div>
                    <div className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800 text-center">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2">System Status</div>
                      <div className="text-3xl font-orbitron font-black italic text-blue-500">NOMINAL</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 italic">Transaction Logs</h3>
                      <button onClick={handleClearLogs} className="text-[10px] font-bold uppercase text-red-500 hover:text-red-400 transition-colors">Wipe History</button>
                    </div>
                    <div className="space-y-2 overflow-y-auto max-h-[300px] no-scrollbar">
                      {apiLogs.map(log => (
                        <div key={log.id} className="bg-black/40 border border-zinc-800/50 p-4 rounded-2xl flex justify-between items-center text-[10px]">
                           <div className="flex flex-col">
                             <span className="text-white font-bold uppercase">{log.category} / {log.subcategory}</span>
                             <span className="text-zinc-500 font-mono mt-0.5">{new Date(log.timestamp).toLocaleString()}</span>
                           </div>
                           <div className="flex items-center space-x-4">
                              <span className={`font-black ${log.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>{log.status.toUpperCase()}</span>
                              <span className="text-zinc-600 font-mono">${log.cost}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-zinc-800 bg-black/40 flex justify-end">
               <button onClick={() => setIsAdminOpen(false)} className="px-10 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full hover:bg-blue-500 hover:text-white transition-all">Close Dashboard</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="px-6 py-2 flex justify-between items-center border-b border-zinc-900 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div 
          className="flex items-center cursor-pointer group" 
          onClick={() => {
            if (!state.currentUser) return;
            setState(prev => ({ ...prev, step: AppStep.UPLOAD, sourceImage: null, selectedCategory: null, selectedSubcategory: null, customPrompt: '', resultImage: null, isComicStyled: false, isCardStyled: false, stats: null, characterName: '', characterDescription: '', cardStatusText: 'PREMIUM COLLECTOR', styleIntensity: 80, resultScale: 1, resultOffset: { x: 0, y: 0 }, error: null, editingId: null }));
          }}
        >
          <img src={logoUrl} crossOrigin="anonymous" className="w-[100px] h-[100px] object-contain" alt="Logo" />
          <h1 className="text-2xl font-orbitron font-bold tracking-tighter uppercase ml-4">FOR THE <span className="text-blue-500">COS</span></h1>
        </div>
        
        <div className="flex items-center space-x-6">
          {state.currentUser && (
            <>
              <button 
                onClick={() => setState(prev => ({ ...prev, step: AppStep.GALLERY }))}
                className={`text-sm font-bold uppercase tracking-widest transition-colors flex items-center space-x-2 ${state.step === AppStep.GALLERY ? 'text-blue-500' : 'text-zinc-500 hover:text-white'}`}
              >
                <i className="fa-solid fa-layer-group"></i>
                <span className="hidden md:inline">Gallery</span>
                {galleryItems.length > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{galleryItems.length}</span>}
              </button>

              {isUserAdmin && (
                <button onClick={() => setIsAdminOpen(true)} className="text-zinc-500 hover:text-white transition-colors" title="Admin Panel">
                  <i className="fa-solid fa-gauge-high"></i>
                </button>
              )}

              <button onClick={handleLogout} className="text-zinc-500 hover:text-red-500 transition-colors" title="Logout">
                <i className="fa-solid fa-power-off"></i>
              </button>
              
              {(state.step !== AppStep.UPLOAD || state.error) && state.step !== AppStep.PROCESSING && state.step !== AppStep.GALLERY && (
                <button onClick={goBack} className="px-6 py-2 bg-zinc-900 rounded-full border border-zinc-800 flex items-center space-x-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
                  <i className="fa-solid fa-arrow-left text-xs"></i>
                  <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col justify-center">
        {state.step === AppStep.UPLOAD && <PhotoStep onPhotoSelected={handlePhotoSelected} />}

        {state.step === AppStep.CATEGORY_SELECT && (
          <div className="py-12"><Carousel items={CATEGORIES} onItemSelect={handleCategorySelect} title="SELECT YOUR REALITY" /></div>
        )}

        {state.step === AppStep.SUBCATEGORY_SELECT && (
          <div className="py-12 space-y-12">
            {state.selectedCategory?.id === 'custom' ? (
              <div className="max-w-2xl mx-auto px-6 space-y-8">
                <div className="text-center space-y-4">
                  <h2 className="text-4xl font-orbitron font-bold text-blue-400 tracking-wider uppercase">Manifest Destiny</h2>
                  <p className="text-zinc-400">Describe the specific world you want to step into.</p>
                </div>
                <textarea 
                  value={state.customPrompt}
                  onChange={(e) => setState(prev => ({ ...prev, customPrompt: e.target.value }))}
                  placeholder="Standing amidst ruins of a neon citadel under a binary star system..."
                  className="w-full h-48 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-lg text-white placeholder-zinc-700"
                />
                <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/50 backdrop-blur-md space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-orbitron font-bold text-blue-500 uppercase tracking-widest text-sm">Reality Filter</h3>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{state.styleIntensity < 30 ? 'Cartoonish' : state.styleIntensity > 70 ? 'Real Life' : 'Stylized'}</span>
                  </div>
                  <input type="range" min="0" max="100" value={state.styleIntensity} onChange={(e) => setState(prev => ({ ...prev, styleIntensity: parseInt(e.target.value) }))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
                <div className="flex justify-between items-center">
                  <button onClick={goBack} className="px-10 py-4 bg-zinc-900 rounded-full font-bold border border-zinc-800 hover:bg-zinc-800 transition-colors">CANCEL</button>
                  <button onClick={startProcessing} className={`px-14 py-4 rounded-full font-bold transition-all ${state.customPrompt.trim() ? 'bg-blue-600 hover:bg-blue-500 shadow-lg glow-effect' : 'bg-zinc-800 opacity-50 cursor-not-allowed'}`}>GENERATE</button>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <Carousel items={state.selectedCategory?.subcategories || []} onItemSelect={handleSubcategorySelect} title={`${state.selectedCategory?.name.toUpperCase()} DOMAINS`} isSubView={true} onBack={goBack} onConfirm={startProcessing} selectedIndex={state.selectedCategory?.subcategories?.findIndex(s => s.id === state.selectedSubcategory?.id)} />
                {state.selectedSubcategory && (
                  <div className="max-w-md mx-auto px-6 animate-fade-in">
                    <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/50 backdrop-blur-md space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="font-orbitron font-bold text-blue-500 uppercase tracking-widest text-sm">Reality Filter</h3>
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{state.styleIntensity < 30 ? 'Cartoonish' : state.styleIntensity > 70 ? 'Real Life' : 'Stylized'}</span>
                      </div>
                      <input type="range" min="0" max="100" value={state.styleIntensity} onChange={(e) => setState(prev => ({ ...prev, styleIntensity: parseInt(e.target.value) }))} className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {state.step === AppStep.PROCESSING && (
          <div className="flex flex-col items-center justify-center space-y-12 p-12">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full animate-ping"></div>
              <div className="absolute inset-4 border-2 border-blue-500/40 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center"><img src={logoUrl} crossOrigin="anonymous" className="w-20 h-20 object-contain animate-bounce" alt="logo" /></div>
            </div>
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-orbitron font-bold tracking-[0.2em] text-blue-500 animate-pulse uppercase">Dimension Hopping</h2>
              <p className="text-zinc-500 font-mono text-sm tracking-widest uppercase bg-zinc-900/50 px-6 py-2 rounded-full border border-zinc-800 inline-block">{loadingMessage}</p>
            </div>
          </div>
        )}

        {state.step === AppStep.RESULT && state.resultImage && (
          <div className="p-6 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-12 items-start justify-center">
            
            <div className="absolute left-[-9999px] top-0 opacity-1 pointer-events-none overflow-hidden" style={{ width: '4000px', height: '4000px' }}>
              {state.resultImage && state.sourceImage && state.stats && (
                <>
                  <div ref={rawImageRef} style={{ width: '768px', height: '1024px', overflow: 'hidden', position: 'relative' }}>
                    <img src={state.resultImage} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                  </div>
                  <div ref={comicExportRef} style={{ width: '800px', height: '1200px', overflow: 'hidden', position: 'relative', backgroundColor: '#000' }}>
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <img src={state.resultImage} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                      <ComicFrame category={state.selectedCategory?.name || "HERO"} subcategory={state.selectedSubcategory?.name || "ULTIMATE"} customTitle={state.characterName} />
                    </div>
                  </div>
                  <div ref={cardFrontRef} style={{ width: '900px', height: '1200px', position: 'relative' }}>
                    <TradingCard frontImage={state.resultImage} backImage={state.sourceImage} stats={state.stats} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={false} onFlip={() => {}} statusText={state.cardStatusText} imageScale={state.resultScale} imageOffset={state.resultOffset} exportSide="front" />
                  </div>
                  <div ref={cardBackRef} style={{ width: '900px', height: '1200px', position: 'relative' }}>
                    <TradingCard frontImage={state.resultImage} backImage={state.sourceImage} stats={state.stats} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={true} onFlip={() => {}} statusText={state.cardStatusText} imageScale={state.resultScale} imageOffset={state.resultOffset} exportSide="back" />
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 w-full max-w-lg mx-auto space-y-4">
              <div className={`relative group rounded-3xl ${state.isCardStyled ? '' : 'overflow-hidden shadow-2xl'} border-[10px] border-black bg-black`}>
                <div className={`relative overflow-hidden transition-all duration-500 ${state.isComicStyled ? 'aspect-[2/3]' : 'aspect-[3/4]'}`}>
                  {state.isComicStyled && (
                    <div className="w-full h-full relative">
                      <div className="w-full h-full overflow-hidden relative">
                        <img src={state.resultImage} crossOrigin="anonymous" alt="Transformation result" className="w-full h-full object-cover transition-all duration-700 origin-center" style={{ transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                      </div>
                      <ComicFrame category={state.selectedCategory?.name || "HERO"} subcategory={state.selectedSubcategory?.name || "ULTIMATE"} customTitle={state.characterName} />
                    </div>
                  )}
                  {state.isCardStyled && state.stats && state.sourceImage && (
                    <TradingCard frontImage={state.resultImage} backImage={state.sourceImage} stats={state.stats} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'Cosplay'} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} statusText={state.cardStatusText} imageScale={state.resultScale} imageOffset={state.resultOffset} />
                  )}
                  {!state.isComicStyled && !state.isCardStyled && (
                    <img src={state.resultImage} crossOrigin="anonymous" alt="Transformation result" className="w-full h-full object-cover transition-all duration-700 origin-center" style={{ transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                  )}
                </div>

                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-8 space-y-3 z-50 cursor-pointer overflow-y-auto no-scrollbar" onClick={(e) => { if (state.isCardStyled && e.target === e.currentTarget) { setIsFlipped(!isFlipped); } }}>
                   <h4 className="font-orbitron font-bold text-blue-400 uppercase tracking-widest text-sm mb-1 italic pointer-events-none">Artifact Options</h4>
                   <div className="grid grid-cols-1 w-full gap-2 px-4">
                     <button onClick={() => downloadResult('raw')} className="flex items-center space-x-3 w-full bg-white/10 hover:bg-white/20 p-3 rounded-xl border border-white/10 transition-all">
                       <i className="fa-solid fa-image w-6"></i>
                       <span className="text-xs font-bold uppercase tracking-widest">Download Base Image</span>
                     </button>
                     
                     {state.isCardStyled && (
                       <>
                        <button onClick={() => setIsFlipped(!isFlipped)} className="flex items-center space-x-3 w-full bg-zinc-700 hover:bg-zinc-600 p-3 rounded-xl transition-all text-white border border-white/10">
                          <i className="fa-solid fa-arrows-rotate w-6"></i>
                          <span className="text-xs font-bold uppercase tracking-widest">Flip Card</span>
                        </button>
                        <button onClick={() => downloadResult('card-front')} className="flex items-center space-x-3 w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-xl transition-all text-white shadow-lg">
                          <i className="fa-solid fa-file-image w-6"></i>
                          <span className="text-xs font-bold uppercase tracking-widest">Save Front</span>
                        </button>
                       </>
                     )}

                     {state.isComicStyled && (
                       <button onClick={() => downloadResult('comic')} className="flex items-center space-x-3 w-full bg-yellow-500 hover:bg-yellow-400 p-3 rounded-xl transition-all text-black shadow-lg">
                         <i className="fa-solid fa-book-open w-6"></i>
                         <span className="text-xs font-bold uppercase tracking-widest">Save Comic Cover</span>
                       </button>
                     )}
                   </div>
                </div>
              </div>

              {/* Physical Print Teaser */}
              {(state.isComicStyled || state.isCardStyled) && (
                <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-6 rounded-3xl border border-blue-500/30 shadow-xl space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-orbitron font-black text-white italic uppercase tracking-tighter">Physical Archive</h4>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Premium Glossy Art Print</p>
                    </div>
                    <div className="text-right">
                       <span className="text-2xl font-black font-orbitron text-white italic">${state.isComicStyled ? adminSettings.priceComicPrint : adminSettings.priceCardSet}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsCheckoutOpen(true)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg flex items-center justify-center space-x-3 group"
                  >
                    <i className="fa-solid fa-truck-fast group-hover:translate-x-1 transition-transform"></i>
                    <span>Manifest Physical Copy</span>
                  </button>
                </div>
              )}
              
              <div className="flex items-center justify-center space-x-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                <i className="fa-solid fa-arrows-rotate animate-spin-slow"></i>
                <span>{state.isCardStyled ? 'Click card or overlay to flip' : 'Hover for export options'}</span>
              </div>
            </div>
            
            <div className="w-full lg:w-96 space-y-6">
              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-md space-y-6">
                <h3 className="font-orbitron font-black text-xl mb-2 text-blue-500 italic tracking-tighter uppercase">Visual Matrix</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Scale / Zoom</label>
                      <span className="text-xs font-mono text-blue-500">{Math.round(state.resultScale * 100)}%</span>
                    </div>
                    <input type="range" min="1" max="3" step="0.01" value={state.resultScale} onChange={(e) => handleScaleChange(parseFloat(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Horizontal Pan</label>
                      <span className="text-xs font-mono text-blue-500">{state.resultOffset.x}%</span>
                    </div>
                    <input type="range" min="-50" max="50" step="1" value={state.resultOffset.x} onChange={(e) => handleOffsetChange('x', parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Vertical Pan</label>
                      <span className="text-xs font-mono text-blue-500">{state.resultOffset.y}%</span>
                    </div>
                    <input type="range" min="-50" max="50" step="1" value={state.resultOffset.y} onChange={(e) => handleOffsetChange('y', parseInt(e.target.value))} className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>
                  <button onClick={() => setState(prev => ({ ...prev, resultScale: 1, resultOffset: { x: 0, y: 0 } }))} className="w-full py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all">Reset Framing</button>
                </div>
              </div>

              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-md space-y-4">
                <h3 className="font-orbitron font-black text-xl mb-2 text-white italic tracking-tighter uppercase">Identity Data</h3>
                <div className="space-y-4">
                  <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Hero Name</label><input type="text" value={state.characterName} onChange={(e) => setState(prev => ({ ...prev, characterName: e.target.value }))} className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none transition-all" /></div>
                  <div><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Character Bio</label><textarea value={state.characterDescription} onChange={(e) => setState(prev => ({ ...prev, characterDescription: e.target.value }))} className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none transition-all h-24 resize-none" /></div>
                  {state.isCardStyled && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Card Label (Max 17 Chars)</label>
                      <input type="text" maxLength={17} value={state.cardStatusText} onChange={(e) => setState(prev => ({ ...prev, cardStatusText: e.target.value }))} className="w-full bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:border-blue-500 outline-none transition-all" placeholder="PREMIUM COLLECTOR" />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 backdrop-blur-md space-y-4">
                <h3 className="font-orbitron font-black text-xl mb-2 text-white italic tracking-tighter uppercase">Artifact Styles</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={toggleComicStyle} className={`py-3 rounded-xl font-black text-[10px] transition-all flex flex-col items-center justify-center space-y-2 border-2 ${state.isComicStyled ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white'}`}><i className="fa-solid fa-book-open text-base"></i><span className="uppercase tracking-widest">Comic Mode</span></button>
                  <button onClick={toggleCardStyle} className={`py-3 rounded-xl font-black text-[10px] transition-all flex flex-col items-center justify-center space-y-2 border-2 ${state.isCardStyled ? 'bg-blue-600 text-white border-blue-400' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white'}`}><i className="fa-solid fa-address-card text-base"></i><span className="uppercase tracking-widest">Card Mode</span></button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button onClick={saveToHistoryOnly} disabled={isSaving} className="w-full py-4 bg-white text-black rounded-full font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl flex items-center justify-center space-x-3">{isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}<span>{isSaving ? 'Syncing...' : (state.editingId ? 'Update Artifact' : 'Sync to Chronicles')}</span></button>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setState(prev => ({ ...prev, step: AppStep.CATEGORY_SELECT, resultImage: null, selectedCategory: null, selectedSubcategory: null, isComicStyled: false, isCardStyled: false, editingId: null }))} className="py-3 bg-zinc-900 border border-zinc-800 rounded-2xl font-bold hover:bg-zinc-800 transition-all text-[10px] uppercase tracking-widest">New World</button>
                  <button onClick={() => setState(prev => ({ ...prev, step: AppStep.UPLOAD, sourceImage: null, resultImage: null, selectedCategory: null, selectedSubcategory: null, isComicStyled: false, isCardStyled: false, editingId: null }))} className="py-3 bg-zinc-900 border border-zinc-800 rounded-2xl font-bold hover:bg-zinc-800 transition-all text-[10px] uppercase tracking-widest">New Image</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.step === AppStep.GALLERY && (
          <div className="p-8 max-w-7xl mx-auto w-full space-y-12 animate-fade-in">
             <div className="flex justify-between items-end border-b border-zinc-900 pb-6">
               <div className="space-y-2">
                 <h2 className="text-5xl font-orbitron font-black italic tracking-tighter uppercase text-white">The Archives</h2>
                 <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">A visual history of your dimensional shifting.</p>
               </div>
               <button onClick={() => setState(prev => ({ ...prev, step: AppStep.UPLOAD }))} className="bg-blue-600 px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-blue-500 transition-all">New Cosplay</button>
             </div>
             {galleryItems.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-24 space-y-6 text-zinc-700">
                  <i className="fa-solid fa-box-open text-6xl"></i>
                  <p className="font-orbitron font-bold tracking-widest uppercase">The archives are empty</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                 {galleryItems.map(item => (
                   <div key={item.id} className="bg-zinc-900/40 rounded-3xl border border-zinc-800/50 overflow-hidden group hover:border-blue-500/50 transition-all">
                      <div className="aspect-[3/4] relative overflow-hidden bg-black">
                         <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={item.name} />
                         <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                         <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px] space-y-3 px-6">
                            <button onClick={() => handleEditGalleryItem(item)} className="w-full py-3 bg-white text-black rounded-xl flex items-center justify-center space-x-2 font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 hover:text-white transition-all"><i className="fa-solid fa-pen-to-square"></i><span>Edit Archive</span></button>
                            <button onClick={() => deleteItem(item.id)} className="w-full py-3 bg-red-600/20 text-red-500 border border-red-500/50 rounded-xl flex items-center justify-center space-x-2 font-black uppercase text-[10px] tracking-widest hover:bg-red-600 hover:text-white transition-all"><i className="fa-solid fa-trash-can"></i><span>Erase Data</span></button>
                         </div>
                         <div className="absolute top-4 right-4"><span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase font-black">{item.type}</span></div>
                      </div>
                      <div className="p-5 space-y-1">
                         <h4 className="font-orbitron font-bold text-sm uppercase tracking-tighter truncate">{item.name}</h4>
                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{item.category} Matrix</p>
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </main>

      <footer className="py-8 px-8 text-center border-t border-zinc-900 bg-black/40">
        <div className="flex flex-col items-center space-y-4">
           <img src={logoUrl} crossOrigin="anonymous" className="h-8 w-auto opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all" alt="Footer Logo" />
           <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">&copy; 2024 FOR THE COS. DIMENSIONS SYNERGIZED VIA GEMINI AI.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;