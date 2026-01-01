
import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { AppStep, AppState, Category, Subcategory, CardStats, AdminSettings, SavedGeneration, ApiLog, PhysicalOrder, User, UserProfile, SocialLinks, Comment } from './types';
import { CATEGORIES } from './constants';
import PhotoStep from './components/PhotoStep';
import Carousel from './components/Carousel';
import ComicFrame from './components/ComicFrame';
import TradingCard from './components/TradingCard';
import { processCosplayImage } from './services/gemini';
import { 
  saveGeneration, 
  getAllGenerations, 
  deleteGeneration, 
  saveOrder, 
  getCurrentUser, 
  signIn, 
  signUp, 
  signOut, 
  getProfileById, 
  updateProfile, 
  getPublicGenerations, 
  toggleLike, 
  getSupabase
} from './services/db';

const ADMIN_EMAIL_LOWER = "roarshackstudios@gmail.com";

const App: React.FC = () => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [checkoutSnapshot, setCheckoutSnapshot] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);
  
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {
    const saved = localStorage.getItem('cos-admin-settings');
    const defaults = {
      defaultTitle: "THE LEGENDARY",
      defaultDescription: "The manifestation of this masterpiece represents a perfect fusion of character and dimension.",
      paypalLinkComic: "",
      paypalLinkCard: "",
      priceComicPrint: 14.99,
      priceCardSet: 8.99,
      supabaseUrl: "",
      supabaseAnonKey: "",
      n8nWebhookUrl: ""
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  const [galleryItems, setGalleryItems] = useState<SavedGeneration[]>([]);
  const [publicFeed, setPublicFeed] = useState<SavedGeneration[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const [isLikingId, setIsLikingId] = useState<string | null>(null);
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedArtifact, setSelectedArtifact] = useState<SavedGeneration | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isVerifyingWithN8n, setIsVerifyingWithN8n] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const logoUrl = "https://i.ibb.co/b43T8dM/1.png";
  const isSupabaseConfigured = getSupabase() !== null;

  const [state, setState] = useState<AppState>({
    step: AppStep.HOME,
    currentUser: null,
    targetProfile: null,
    sourceImage: null,
    selectedCategory: null,
    selectedSubcategory: null,
    customPrompt: '',
    resultImage: null,
    isComicStyled: false,
    isCardStyled: false,
    stats: { strength: 5, intelligence: 6, agility: 4, speed: 5 },
    characterName: '',
    characterDescription: '',
    cardStatusText: 'PREMIUM COLLECTOR',
    styleIntensity: 80, 
    resultScale: 1,
    resultOffset: { x: 0, y: 0 },
    error: null,
    editingId: null
  });

  const [isFlipped, setIsFlipped] = useState(false);

  const isAdmin = (state.currentUser?.email?.toLowerCase() === ADMIN_EMAIL_LOWER) || !isSupabaseConfigured || (!state.currentUser);

  useEffect(() => {
    let interval: any;
    if (isVerifyingWithN8n && pendingOrderId) {
      const client = getSupabase();
      if (!client) return;

      interval = setInterval(async () => {
        const { data, error } = await client
          .from('orders')
          .select('status')
          .eq('id', pendingOrderId)
          .single();
        
        if (!error && data?.status === 'paid') {
          setIsVerifyingWithN8n(false);
          setIsPaymentSuccess(true);
          clearInterval(interval);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isVerifyingWithN8n, pendingOrderId]);

  const loadGallery = async (userId: string) => {
    try {
      const items = await getAllGenerations(userId);
      setGalleryItems(items);
    } catch (e) {
      console.warn("Gallery sync failed:", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (isSupabaseConfigured) {
        try {
          const user = await getCurrentUser();
          if (user) {
            setState(prev => ({ ...prev, currentUser: user }));
            loadGallery(user.id);
            const profile = await getProfileById(user.id);
            setMyProfile(profile);
          }
          refreshFeed(user?.id);
        } catch (e) {
          console.error("Core sync failure:", e);
        }
      }
    };
    init();
  }, [isSupabaseConfigured]);

  const refreshFeed = async (userId?: string) => {
    if (!isSupabaseConfigured) return;
    setIsRefreshingFeed(true);
    try {
      const currentUserId = userId || state.currentUser?.id;
      const feed = await getPublicGenerations(currentUserId);
      setPublicFeed(feed);
    } catch (e: any) {
      console.warn("Feed update failed:", e.message);
    } finally {
      setIsRefreshingFeed(false);
    }
  };

  const handleLike = async (e: React.MouseEvent, genId: string) => {
    e.stopPropagation();
    if (!state.currentUser) {
      setState(prev => ({ ...prev, step: AppStep.LOGIN }));
      return;
    }
    
    // OPTIMISTIC UPDATE: Change state immediately
    const toggleOptimistically = (current: SavedGeneration[]) => 
      current.map(item => {
        if (item.id === genId) {
          const wasLiked = item.userHasLiked;
          return {
            ...item,
            userHasLiked: !wasLiked,
            likeCount: (item.likeCount || 0) + (wasLiked ? -1 : 1)
          };
        }
        return item;
      });

    setPublicFeed(prev => toggleOptimistically(prev));
    if (selectedArtifact && selectedArtifact.id === genId) {
      setSelectedArtifact(prev => prev ? ({
        ...prev,
        userHasLiked: !prev.userHasLiked,
        likeCount: (prev.likeCount || 0) + (prev.userHasLiked ? -1 : 1)
      }) : null);
    }

    try {
      await toggleLike(state.currentUser.id, genId);
      // We don't even NEED to refresh the whole feed because we were optimistic,
      // but we do it silently to stay in sync with others.
      const updatedFeed = await getPublicGenerations(state.currentUser.id);
      setPublicFeed(updatedFeed);
    } catch (e: any) {
      console.error("Synergy failure:", e);
      // Rollback on error
      refreshFeed();
      alert(`Synergy Error: ${e.message}. The neural link might be weak.`);
    }
  };

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSupabaseConfigured) { setShowAdmin(true); return; }
    setAuthLoading(true);
    setState(prev => ({ ...prev, error: null }));
    const mode = state.step === AppStep.LOGIN ? 'login' : 'signup';
    
    try {
      let user: User;
      if (mode === 'login') user = await signIn(authEmail.toLowerCase().trim(), authPassword);
      else user = await signUp(authEmail.toLowerCase().trim(), authPassword);
      setState(prev => ({ ...prev, currentUser: user, step: AppStep.STUDIO }));
      loadGallery(user.id);
      const profile = await getProfileById(user.id);
      setMyProfile(profile);
      refreshFeed(user.id);
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message }));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setState(prev => ({ ...prev, currentUser: null, step: AppStep.HOME, targetProfile: null }));
    setMyProfile(null);
    setGalleryItems([]);
    refreshFeed();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;
    setIsUpdatingProfile(true);
    try {
      await updateProfile(myProfile);
      alert("Identity synchronized.");
    } catch (err: any) {
      alert(`Sync failure: ${err.message}`);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePhotoSelected = (base64: string) => {
    setState(prev => ({ ...prev, sourceImage: base64, step: AppStep.CATEGORY_SELECT }));
  };

  const startProcessing = async () => {
    if (!state.sourceImage || !state.selectedCategory) return;
    setState(prev => ({ ...prev, step: AppStep.PROCESSING, error: null }));
    
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
        stats: { strength: 5, intelligence: 6, agility: 4, speed: 5 },
        characterName: `${adminSettings.defaultTitle} ${state.selectedSubcategory?.name || 'HERO'}`,
        characterDescription: adminSettings.defaultDescription,
        cardStatusText: 'PREMIUM COLLECTOR',
        resultScale: 1,
        resultOffset: { x: 0, y: 0 },
        editingId: null
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || String(err), step: AppStep.STUDIO }));
    }
  };

  const saveToHistory = async (forcePublic = false): Promise<string | null> => {
    if (!state.resultImage || isSaving || !state.currentUser) return null;
    setIsSaving(true);
    try {
      const newId = state.editingId || crypto.randomUUID();
      await saveGeneration({
        id: newId,
        userId: state.currentUser.id,
        timestamp: Date.now(),
        image: state.resultImage, 
        name: state.characterName,
        category: state.selectedCategory?.name || 'Unknown',
        type: state.isComicStyled ? 'comic' : (state.isCardStyled ? 'card' : 'raw'),
        stats: state.stats || undefined,
        description: state.characterDescription,
        cardStatusText: state.cardStatusText,
        originalSourceImage: state.sourceImage || undefined,
        isPublic: forcePublic,
        resultScale: state.resultScale,
        resultOffset: state.resultOffset
      });
      await loadGallery(state.currentUser.id);
      if (forcePublic) await refreshFeed();
      return newId;
    } catch (err: any) {
      alert(`Synthesis Error: ${err.message}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const captureSnapshot = async () => {
    if (!previewRef.current) return null;
    try {
      await new Promise(r => setTimeout(r, 200));
      const dataUrl = await toPng(previewRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      });
      return dataUrl;
    } catch (e) {
      console.error("Snapshot capture failed:", e);
      return null;
    }
  };

  const initiatePayment = async () => {
    const orderId = crypto.randomUUID();
    setPendingOrderId(orderId);
    
    if (state.currentUser && state.resultImage) {
      try {
        await saveOrder({
          id: orderId,
          userId: state.currentUser.id,
          timestamp: Date.now(),
          paypalOrderId: 'WEB_LINK_PENDING',
          itemType: state.isComicStyled ? 'comic_print' : 'card_set',
          itemName: state.characterName,
          amount: state.isComicStyled ? adminSettings.priceComicPrint : adminSettings.priceCardSet,
          status: 'pending',
          previewImage: checkoutSnapshot || state.resultImage
        });

        const baseLink = state.isComicStyled ? adminSettings.paypalLinkComic : adminSettings.paypalLinkCard;
        if (!baseLink) {
          alert("Payment links not configured.");
          return;
        }

        const trackingData = encodeURIComponent(`${state.currentUser.id}|${orderId}`);
        const separator = baseLink.includes('?') ? '&' : '?';
        const finalLink = `${baseLink}${separator}custom=${trackingData}`;
        
        window.open(finalLink, '_blank');
        setIsVerifyingWithN8n(true);
      } catch (e) {
        alert("Verification sequence failed to initiate.");
      }
    }
  };

  const handleEditGeneration = (item: SavedGeneration) => {
    const categoryObj = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[0];
    setState(prev => ({
      ...prev,
      step: AppStep.RESULT,
      editingId: item.id,
      sourceImage: item.originalSourceImage || null,
      resultImage: item.image, 
      selectedCategory: categoryObj,
      characterName: item.name,
      characterDescription: item.description || adminSettings.defaultDescription,
      cardStatusText: item.cardStatusText || 'PREMIUM COLLECTOR',
      stats: item.stats || { strength: 5, intelligence: 6, agility: 4, speed: 5 },
      isComicStyled: item.type === 'comic',
      isCardStyled: item.type === 'card',
      resultScale: item.resultScale || 1,
      resultOffset: item.resultOffset || { x: 0, y: 0 }
    }));
  };

  const goBack = () => {
    if (state.step === AppStep.CATEGORY_SELECT) setState(prev => ({ ...prev, step: AppStep.STUDIO }));
    else if (state.step === AppStep.SUBCATEGORY_SELECT) setState(prev => ({ ...prev, step: AppStep.CATEGORY_SELECT }));
    else if (state.step === AppStep.RESULT) setState(prev => ({ ...prev, step: AppStep.SUBCATEGORY_SELECT }));
    else if (state.step === AppStep.CHECKOUT) setState(prev => ({ ...prev, step: AppStep.RESULT }));
    else if ([AppStep.GALLERY, AppStep.PROFILE, AppStep.VIEW_PROFILE, AppStep.COMMUNITY].includes(state.step)) 
      setState(prev => ({ ...prev, step: prev.currentUser ? AppStep.STUDIO : AppStep.HOME }));
  };

  const renderArtifactCard = (item: SavedGeneration) => (
    <div key={item.id} className="bg-zinc-900/40 rounded-[2rem] border border-zinc-800 overflow-hidden group hover:border-blue-500/50 transition-all hover:shadow-[0_0_40px_rgba(59,130,246,0.1)] relative flex flex-col">
      <div className="aspect-[3/4] relative bg-black overflow-hidden cursor-pointer" onClick={() => { setSelectedArtifact(item); }}>
        <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={item.name} />
        <div className="absolute top-4 left-4 flex space-x-2">
          <span className={`px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest border shadow-xl ${item.type === 'comic' ? 'bg-yellow-500 text-black border-yellow-300' : (item.type === 'card' ? 'bg-blue-600 text-white border-blue-400' : 'bg-zinc-800 text-zinc-400 border-zinc-700')}`}>
            {item.type}
          </span>
        </div>
        <button 
          onClick={(e) => handleLike(e, item.id)} 
          className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 hover:border-blue-500/50 transition-all active:scale-90"
        >
          <i className={`fa-solid fa-bolt ${item.userHasLiked ? 'text-blue-500' : 'text-zinc-500'} text-xs`}></i>
          {item.likeCount && item.likeCount > 0 ? <span className="text-[8px] font-bold ml-1.5 text-white/50">{item.likeCount}</span> : null}
        </button>
      </div>
      <div className="p-5 bg-zinc-950/80 backdrop-blur-md flex flex-col space-y-3">
        <h4 className="font-orbitron font-bold text-sm uppercase truncate text-white tracking-tight">{item.name}</h4>
        <button onClick={() => item.userProfile && setState(prev => ({ ...prev, targetProfile: item.userProfile!, step: AppStep.VIEW_PROFILE }))} className="text-[9px] text-zinc-500 font-black uppercase mt-1 tracking-widest hover:text-blue-400 transition-colors flex items-center">
          <div className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden mr-1.5">
            {item.userProfile?.avatar_url ? <img src={item.userProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold">{item.userProfile?.display_name?.[0] || 'P'}</div>}
          </div>
          {item.userProfile?.display_name || 'PILOT'}
        </button>
      </div>
    </div>
  );

  const nexusSchemaFix = `-- NEXUS REPAIR SCRIPT (v6 - OPTIMIZED) --
-- Use this to fix Synergy/Like 406 errors --

-- 1. CLEAN RESET
DROP TABLE IF EXISTS public.likes CASCADE;

-- 2. REBUILD SYNERGY TABLE
CREATE TABLE public.likes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, generation_id)
);

-- 3. PERMISSIONS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Synergy Access" ON public.likes FOR ALL USING (true) WITH CHECK (true);

-- 4. ENSURE PROFILES EXIST & ARE SYNCED
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Profile Access" ON public.profiles;
CREATE POLICY "Public Profile Access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 5. CACHE RESET
NOTIFY pgrst, 'reload schema';

-- 6. Done
SELECT 'Synergy Restored' as Status;`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-inter">
      <header className="px-6 py-4 flex justify-between items-center border-b border-zinc-900 bg-black/80 backdrop-blur-xl sticky top-0 z-[100]">
        <div className="flex items-center cursor-pointer" onClick={() => setState(prev => ({ ...prev, step: AppStep.HOME }))}>
          <img src={logoUrl} className="w-12 h-12 object-contain" alt="Logo" />
          <h1 className="text-xl font-orbitron font-bold tracking-tighter uppercase ml-3">FOR THE <span className="text-blue-500">COS</span></h1>
        </div>
        <div className="flex items-center space-x-6">
          <button onClick={() => setState(prev => ({ ...prev, step: AppStep.COMMUNITY }))} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${state.step === AppStep.COMMUNITY ? 'text-blue-500' : 'text-zinc-400 hover:text-white'}`}>Nexus</button>
          {state.currentUser ? (
            <>
              <button onClick={() => setState(prev => ({ ...prev, step: AppStep.STUDIO }))} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${state.step === AppStep.STUDIO ? 'text-blue-500' : 'text-zinc-400 hover:text-white'}`}>Studio</button>
              <button onClick={() => setState(prev => ({ ...prev, step: AppStep.GALLERY }))} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${state.step === AppStep.GALLERY ? 'text-blue-500' : 'text-zinc-400 hover:text-white'}`}>Vault</button>
              <button onClick={() => setState(prev => ({ ...prev, step: AppStep.PROFILE }))} className="w-8 h-8 rounded-full border border-blue-500/50 overflow-hidden bg-zinc-900">
                {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold">{myProfile?.display_name?.[0] || '?'}</div>}
              </button>
            </>
          ) : (
            <button onClick={() => setState(prev => ({ ...prev, step: AppStep.LOGIN }))} className="text-[10px] font-black uppercase tracking-widest text-blue-500 border border-blue-500/30 px-4 py-2 rounded-full hover:bg-blue-500/10 transition-all">Login/Signup</button>
          )}
          {isAdmin && <button onClick={() => setShowAdmin(!showAdmin)} className={`transition-colors ${!isSupabaseConfigured ? 'text-red-500 animate-pulse' : 'text-zinc-600 hover:text-white'}`}><i className="fa-solid fa-gear"></i></button>}
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {state.step === AppStep.HOME && (
          <div className="flex flex-col animate-fade-in">
             <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 via-transparent to-black z-10"></div>
                <div className="relative z-20 text-center space-y-10 p-6">
                  <div className="inline-block px-6 py-2 bg-blue-600/10 border border-blue-500/30 rounded-full mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-400">Biological Reality Enhancer v3.1</p>
                  </div>
                  <h2 className="text-7xl md:text-9xl font-orbitron font-black text-white italic uppercase tracking-tighter leading-none">NEURAL<br/><span className="text-blue-500">TRANSFORM</span></h2>
                  <p className="text-zinc-400 max-w-2xl mx-auto uppercase text-xs font-bold tracking-[0.3em] leading-relaxed">Dimension-shifting for cosplayers. Manifest themed realities.</p>
                  <div className="flex flex-wrap justify-center gap-6 pt-6">
                    <button onClick={() => isSupabaseConfigured ? setState(prev => ({ ...prev, step: state.currentUser ? AppStep.STUDIO : AppStep.LOGIN })) : setShowAdmin(true)} className="px-12 py-6 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-blue-500 hover:text-white transition-all shadow-2xl active:scale-95">Initiate Studio</button>
                    <button onClick={() => setState(prev => ({ ...prev, step: AppStep.COMMUNITY }))} className="px-12 py-6 bg-zinc-900 border border-zinc-800 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-800 transition-all active:scale-95">Explore Nexus</button>
                  </div>
                </div>
             </section>
             <section className="p-8 md:p-20 space-y-16">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-8">
                  <h3 className="text-4xl font-orbitron font-black text-white italic uppercase tracking-tighter">LATEST MANIFESTATIONS</h3>
                  <button onClick={() => refreshFeed()} className="text-xs text-blue-500 font-bold uppercase tracking-widest hover:text-white transition-colors">
                    {isRefreshingFeed ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-rotate-right"></i>} Refresh
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                  {publicFeed.length > 0 ? publicFeed.slice(0, 8).map(renderArtifactCard) : <div className="col-span-full py-20 text-center text-zinc-700 font-bold uppercase tracking-widest">No artifacts detected in Nexus</div>}
                </div>
             </section>
          </div>
        )}

        {state.step === AppStep.RESULT && (
          <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 h-full animate-fade-in">
            <div className="lg:col-span-7 bg-zinc-950 flex flex-col items-center justify-center p-12 relative overflow-hidden">
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.05)_0%,_transparent_70%)]"></div>
               <div ref={previewRef} className="w-full max-w-md aspect-[3/4] relative shadow-[0_0_100px_rgba(0,0,0,0.5)] bg-black group/preview">
                  {state.isCardStyled ? (
                    <TradingCard 
                      frontImage={state.resultImage!} 
                      backImage={state.sourceImage!} 
                      stats={state.stats!} 
                      characterName={state.characterName} 
                      characterDescription={state.characterDescription} 
                      category={state.selectedCategory?.name || 'GENERIC'} 
                      isFlipped={isFlipped}
                      onFlip={() => setIsFlipped(!isFlipped)}
                      statusText={state.cardStatusText}
                      imageScale={state.resultScale}
                      imageOffset={state.resultOffset}
                    />
                  ) : (
                    <div className="w-full h-full relative overflow-hidden bg-black border-4 border-zinc-900 rounded-3xl">
                       <img src={state.resultImage!} className="w-full h-full object-cover" style={{ transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />
                       {state.isComicStyled && <ComicFrame category={state.selectedCategory?.name || 'LEGEND'} subcategory={state.selectedSubcategory?.name || 'HERO'} customTitle={state.characterName} />}
                    </div>
                  )}
                  <button onClick={() => setIsZoomed(true)} className="absolute top-4 right-4 z-50 p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-white opacity-0 group-hover/preview:opacity-100 transition-all active:scale-90"><i className="fa-solid fa-expand text-lg"></i></button>
               </div>
            </div>
            <div className="lg:col-span-5 bg-black border-l border-zinc-900 flex flex-col p-10 space-y-12 overflow-y-auto custom-scrollbar">
               <div className="space-y-6"><h3 className="text-3xl font-orbitron font-black italic uppercase tracking-tighter">ARTIFACT <span className="text-blue-500">CONTROL</span></h3><div className="flex bg-zinc-900 p-1 rounded-2xl space-x-1">{['raw', 'comic', 'card'].map(type => (<button key={type} onClick={() => setState(p => ({ ...p, isComicStyled: type==='comic', isCardStyled: type==='card' }))} className={`flex-grow py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${((type==='comic' && state.isComicStyled) || (type==='card' && state.isCardStyled) || (type==='raw' && !state.isComicStyled && !state.isCardStyled)) ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>{type}</button>))}</div></div>
               <div className="space-y-8 bg-zinc-900/30 p-8 rounded-[2rem] border border-zinc-800">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Identity Details</p>
                    <input type="text" placeholder="NAME" value={state.characterName} onChange={e => setState(p => ({ ...p, characterName: e.target.value }))} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-bold tracking-tight outline-none focus:border-blue-500 uppercase" />
                    <textarea placeholder="DESCRIPTION" value={state.characterDescription} onChange={e => setState(p => ({ ...p, characterDescription: e.target.value }))} className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:border-blue-500 h-32 resize-none" />
                  </div>
                  <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Positioning</p>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4"><span className="text-[10px] font-bold w-12 uppercase text-zinc-600">Scale</span><input type="range" min="0.5" max="2" step="0.01" value={state.resultScale} onChange={e => setState(p => ({ ...p, resultScale: parseFloat(e.target.value) }))} className="flex-grow accent-blue-600" /></div>
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4"><button onClick={() => saveToHistory(false)} disabled={isSaving} className="py-6 bg-zinc-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] active:scale-95 disabled:opacity-30">VAULT</button><button onClick={() => saveToHistory(true)} disabled={isSaving} className="py-6 bg-zinc-800 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] active:scale-95 disabled:opacity-30">NEXUS</button></div>
               {(state.isComicStyled || state.isCardStyled) && (<button onClick={async () => { if (!state.currentUser) { setState(p => ({ ...p, step: AppStep.LOGIN })); return; } setIsCapturingSnapshot(true); try { const snapshot = await captureSnapshot(); setCheckoutSnapshot(snapshot); const savedId = await saveToHistory(false); if (savedId) setState(p => ({ ...p, step: AppStep.CHECKOUT })); } finally { setIsCapturingSnapshot(false); } }} className="w-full py-8 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[11px] active:scale-95 shadow-2xl">ORDER PHYSICAL PRINT</button>)}
               <button onClick={() => setState(p => ({ ...p, step: AppStep.STUDIO, resultImage: null }))} className="w-full text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors">ABANDON</button>
            </div>
          </div>
        )}

        {state.step === AppStep.CHECKOUT && (
          <div className="flex-grow flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.1)_0%,_transparent_70%)] animate-fade-in">
             <div className="max-w-3xl w-full bg-zinc-900/50 backdrop-blur-3xl border border-zinc-800 rounded-[3.5rem] p-12 space-y-12 shadow-2xl relative overflow-hidden">
                {isPaymentSuccess ? (
                  <div className="text-center space-y-10 py-10 animate-fade-in"><div className="w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-4 border-green-500 shadow-xl"><i className="fa-solid fa-check text-5xl text-green-500"></i></div><h2 className="text-4xl font-orbitron font-black uppercase italic">Confirmed</h2><button onClick={() => { setIsPaymentSuccess(false); setState(prev => ({ ...prev, step: AppStep.GALLERY })); }} className="px-12 py-6 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-blue-500 hover:text-white transition-all">Vault</button></div>
                ) : isVerifyingWithN8n ? (
                  <div className="text-center space-y-12 py-16 animate-fade-in"><div className="w-40 h-40 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div><h2 className="text-3xl font-orbitron font-black uppercase italic tracking-tighter">NEURAL VERIFICATION</h2><p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.5em] animate-pulse">Waiting for dimension link confirmation (n8n)</p></div>
                ) : (
                  <>
                    <div className="flex justify-between items-start"><h2 className="text-5xl font-orbitron font-black uppercase italic leading-none tracking-tighter">CHECKOUT</h2><button onClick={goBack} className="w-12 h-12 flex items-center justify-center bg-zinc-950 rounded-full text-zinc-500"><i className="fa-solid fa-times"></i></button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start"><div className="w-full flex items-center justify-center"><div className="w-full max-w-[320px] aspect-[3/4] border-4 border-zinc-900 rounded-3xl overflow-hidden bg-black shadow-2xl">{checkoutSnapshot ? <img src={checkoutSnapshot} className="w-full h-full object-contain" /> : <div className="p-12 text-center text-xs text-zinc-500 font-bold uppercase">Preparing Artifact...</div>}</div></div><div className="space-y-10"><div className="space-y-6"><p className="text-lg font-black text-white uppercase italic tracking-tighter">TOTAL: ${(state.isComicStyled ? adminSettings.priceComicPrint : adminSettings.priceCardSet).toFixed(2)}</p></div><button onClick={initiatePayment} className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl shadow-blue-600/30 transition-all active:scale-95">INITIATE PAYMENT</button></div></div>
                  </>
                )}
             </div>
          </div>
        )}

        {state.step === AppStep.COMMUNITY && (
          <div className="p-8 md:p-20 space-y-16 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end space-y-8 md:space-y-0">
               <div><h2 className="text-6xl font-orbitron font-black text-white italic uppercase tracking-tighter leading-none">NEURAL NEXUS</h2><p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500 mt-3">Browse the collective</p></div>
               <div className="flex items-center space-x-4"><button onClick={() => refreshFeed()} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 hover:border-blue-500 text-blue-500 transition-all shadow-lg"><i className={`fa-solid fa-rotate-right ${isRefreshingFeed ? 'animate-spin' : ''}`}></i></button><input type="text" placeholder="SEARCH IDENTITIES..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-zinc-900 px-8 py-4 rounded-2xl border border-zinc-800 text-[11px] font-black uppercase outline-none w-full md:w-64 tracking-[0.2em]" /></div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
               {publicFeed.length > 0 ? publicFeed.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(renderArtifactCard) : <div className="col-span-full py-40 text-center text-zinc-700 font-bold uppercase">Nexus quiet...</div>}
             </div>
          </div>
        )}

        {state.step === AppStep.STUDIO && <div className="animate-fade-in h-full flex flex-col items-center justify-center space-y-16 py-32 px-6"><div className="text-center space-y-6"><h2 className="text-6xl md:text-8xl font-orbitron font-black italic uppercase tracking-tighter leading-none">COSPLAY <span className="text-blue-500">STUDIO</span></h2><p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.4em] max-w-xl mx-auto leading-relaxed">Select raw subject matter to begin synthesis.</p></div><div className="w-full max-w-5xl"><PhotoStep onPhotoSelected={handlePhotoSelected} /></div></div>}
        {state.step === AppStep.GALLERY && <div className="p-8 md:p-20 space-y-16 animate-fade-in"><div className="flex justify-between items-end border-b border-zinc-900 pb-10"><div><h2 className="text-6xl font-orbitron font-black text-white italic uppercase tracking-tighter leading-none">PERSONAL <span className="text-blue-500">VAULT</span></h2><p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-4">Archives</p></div><button onClick={() => setState(prev => ({ ...prev, step: AppStep.STUDIO }))} className="bg-blue-600 px-10 py-5 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-500">Synthesize New</button></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">{galleryItems.length > 0 ? galleryItems.map(item => (<div key={item.id} className="group relative bg-zinc-950 rounded-[2.5rem] overflow-hidden border border-zinc-900 hover:border-blue-500 transition-all"><div className="aspect-[3/4] relative cursor-pointer" onClick={() => handleEditGeneration(item)}><img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center"><i className="fa-solid fa-pen-to-square text-2xl"></i></div></div><div className="p-6 flex justify-between items-center bg-black"><h4 className="font-orbitron font-black text-[11px] uppercase truncate">{item.name}</h4><button onClick={async (e) => { e.stopPropagation(); if(confirm("Delete artifact?")) { await deleteGeneration(item.id); loadGallery(state.currentUser!.id); } }} className="text-zinc-800 hover:text-red-500"><i className="fa-solid fa-trash-can"></i></button></div></div>)) : <div className="col-span-full py-40 text-center text-zinc-700 font-bold uppercase">Vault empty</div>}</div></div>}
        {state.step === AppStep.PROFILE && <div className="max-w-4xl w-full mx-auto p-12 md:p-24 space-y-20 animate-fade-in"><div className="flex flex-col md:flex-row items-center space-y-10 md:space-y-0 md:space-x-12"><div className="w-40 h-40 rounded-[3rem] bg-zinc-900 border-4 border-zinc-800 overflow-hidden relative group">{myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-bold">{myProfile?.display_name?.[0] || '?'}</div>}<label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"><i className="fa-solid fa-camera text-2xl"></i><input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setMyProfile(p => p ? ({ ...p, avatar_url: r.result as string }) : null); r.readAsDataURL(f); } }} /></label></div><div><h2 className="text-5xl font-orbitron font-black text-white italic uppercase tracking-tighter">NEURAL IDENTITY</h2><p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">System Interface</p></div></div><form onSubmit={handleUpdateProfile} className="space-y-12"><div className="grid grid-cols-1 md:grid-cols-2 gap-10"><div className="space-y-4"><label className="text-[10px] font-black uppercase text-zinc-600 ml-4">Display Handle</label><input type="text" value={myProfile?.display_name || ''} onChange={e => setMyProfile(p => p ? ({ ...p, display_name: e.target.value }) : null)} className="w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl px-8 py-5 text-sm font-bold uppercase" /></div></div><button type="submit" disabled={isUpdatingProfile} className="w-full py-8 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl shadow-blue-600/30">SYNC IDENTITY</button></form><button onClick={handleLogout} className="w-full text-[10px] font-black uppercase text-red-600/50 pt-12">Sever Neural Link</button></div>}
        {(state.step === AppStep.LOGIN || state.step === AppStep.SIGNUP) && <div className="max-w-md w-full mx-auto p-12 bg-zinc-900/40 border border-zinc-800 rounded-[3.5rem] space-y-12 animate-fade-in m-auto"><div className="text-center space-y-6"><div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 space-x-1.5"><button onClick={() => setState(prev => ({ ...prev, step: AppStep.LOGIN }))} className={`flex-grow py-3 text-[10px] font-black uppercase rounded-xl transition-all ${state.step === AppStep.LOGIN ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Login</button><button onClick={() => setState(prev => ({ ...prev, step: AppStep.SIGNUP }))} className={`flex-grow py-3 text-[10px] font-black uppercase rounded-xl transition-all ${state.step === AppStep.SIGNUP ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Sign-Up</button></div><h2 className="text-4xl font-orbitron font-black uppercase italic leading-none">{state.step === AppStep.LOGIN ? 'Neural Link' : 'New Identity'}</h2></div><form onSubmit={handleAuth} className="space-y-8"><div className="space-y-5"><input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-black/60 border border-zinc-800 rounded-2xl px-8 py-5 text-sm outline-none" placeholder="Email" required /><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-black/60 border border-zinc-800 rounded-2xl px-8 py-5 text-sm outline-none" placeholder="Access Key" required /></div>{state.error && <p className="text-red-500 text-[10px] font-bold uppercase text-center animate-pulse">{state.error}</p>}<button type="submit" disabled={authLoading} className="w-full py-7 bg-blue-600 rounded-2xl font-black uppercase text-[11px] shadow-2xl shadow-blue-600/20">{authLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : (state.step === AppStep.LOGIN ? 'INITIATE' : 'CREATE')}</button></form></div>}
        {state.step === AppStep.CATEGORY_SELECT && (<div className="py-24 animate-fade-in m-auto w-full"><Carousel items={CATEGORIES} onItemSelect={(cat) => setState(prev => ({ ...prev, selectedCategory: cat, step: AppStep.SUBCATEGORY_SELECT }))} title="SELECT DIMENSION" /></div>)}
        {state.step === AppStep.SUBCATEGORY_SELECT && (<div className="py-24 animate-fade-in m-auto w-full"><Carousel items={state.selectedCategory?.subcategories || []} onItemSelect={(sub) => setState(prev => ({ ...prev, selectedSubcategory: sub }))} title={`${state.selectedCategory?.name} DOMAINS`} isSubView={true} onBack={goBack} onConfirm={startProcessing} selectedIndex={state.selectedCategory?.subcategories?.findIndex(s => s.id === state.selectedSubcategory?.id)} /></div>)}
        {state.step === AppStep.PROCESSING && (<div className="flex flex-col items-center justify-center space-y-12 p-12 m-auto"><img src={logoUrl} className="w-64 h-64 animate-heartbeat" /><h2 className="text-5xl font-orbitron font-black text-blue-500 animate-pulse uppercase leading-none">Shifting...</h2></div>)}
      </main>

      {/* Full Screen Zoom Modal */}
      {isZoomed && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-12 animate-fade-in">
           <div className="absolute top-6 right-6 z-[510]"><button onClick={() => setIsZoomed(false)} className="w-16 h-16 bg-zinc-900/80 border border-zinc-800 rounded-full flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-2xl"><i className="fa-solid fa-times text-2xl"></i></button></div>
           <div className="w-full h-full max-w-[85vh] aspect-[3/4] relative">
              {state.isCardStyled ? (
                <TradingCard 
                  frontImage={state.resultImage!} 
                  backImage={state.sourceImage!} 
                  stats={state.stats!} 
                  characterName={state.characterName} 
                  characterDescription={state.characterDescription} 
                  category={state.selectedCategory?.name || 'GENERIC'} 
                  isFlipped={isFlipped}
                  onFlip={() => setIsFlipped(!isFlipped)}
                  statusText={state.cardStatusText}
                  imageScale={state.resultScale}
                  imageOffset={state.resultOffset}
                />
              ) : (
                <div className="w-full h-full relative overflow-hidden bg-black border-[6px] border-zinc-900 rounded-[3rem]"><img src={state.resultImage!} className="w-full h-full object-cover" style={{ transform: `scale(${state.resultScale}) translate(${state.resultOffset.x}%, ${state.resultOffset.y}%)` }} />{state.isComicStyled && <ComicFrame category={state.selectedCategory?.name || 'LEGEND'} subcategory={state.selectedSubcategory?.name || 'HERO'} customTitle={state.characterName} />}</div>
              )}
           </div>
        </div>
      )}

      {showAdmin && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
          <div className="max-w-5xl w-full bg-zinc-950 border border-zinc-800 rounded-[4rem] p-12 space-y-12 shadow-2xl flex flex-col h-[90vh]">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-orbitron font-black uppercase italic tracking-tighter">NEURAL ADMIN PANEL</h2><button onClick={() => setShowAdmin(false)} className="p-4 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"><i className="fa-solid fa-times text-xl"></i></button></div>
            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-10 pr-4">
               
               {/* STEP 1: DATABASE REPAIR */}
               <div className="p-10 bg-red-600/10 border border-red-500/30 rounded-[2.5rem] space-y-8">
                  <div className="flex items-center space-x-3"><i className="fa-solid fa-wrench text-red-500 text-3xl"></i><p className="text-xl font-black text-red-500 uppercase tracking-widest">STEP 1: DATABASE REPAIR (SQL)</p></div>
                  <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/10">
                     <p className="text-[12px] text-white font-black leading-relaxed uppercase mb-2">RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX 'POLICY ALREADY EXISTS' OR '406' ERRORS:</p>
                     <p className="text-[10px] text-zinc-400 font-bold uppercase">v6 OPTIMIZED RESET: Ensures perfect sync between neural artifacts and nexus synergy.</p>
                  </div>
                  <div className="relative group">
                    <pre className="w-full bg-black border border-zinc-800 rounded-2xl p-6 text-[11px] font-mono text-blue-400 overflow-x-auto h-64 custom-scrollbar select-all">
                      {nexusSchemaFix}
                    </pre>
                    <button 
                      onClick={() => { navigator.clipboard.writeText(nexusSchemaFix); alert("Optimized Repair SQL copied! Now paste it into Supabase SQL Editor and click RUN."); }}
                      className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl"
                    >
                      COPY OPTIMIZED REPAIR
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest bg-zinc-900 p-4 rounded-xl text-center italic">After running the script, refresh this browser tab entirely.</p>
               </div>

               {/* OTHER SETTINGS */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] space-y-6">
                    <p className="text-xs font-black text-blue-400 uppercase tracking-widest">SUPABASE CONFIG</p>
                    <input type="text" placeholder="URL" value={adminSettings.supabaseUrl} onChange={e => setAdminSettings({...adminSettings, supabaseUrl: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-6 py-4 text-[11px] font-mono outline-none" />
                    <input type="password" placeholder="ANON KEY" value={adminSettings.supabaseAnonKey} onChange={e => setAdminSettings({...adminSettings, supabaseAnonKey: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-6 py-4 text-[11px] font-mono outline-none" />
                 </div>
                 <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] space-y-6">
                    <p className="text-xs font-black text-blue-400 uppercase tracking-widest">N8N HUB</p>
                    <input type="text" placeholder="Webhook URL" value={adminSettings.n8nWebhookUrl} onChange={e => setAdminSettings({...adminSettings, n8nWebhookUrl: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl px-6 py-4 text-[11px] font-mono outline-none" />
                 </div>
               </div>
            </div>
            <button onClick={() => { localStorage.setItem('cos-admin-settings', JSON.stringify(adminSettings)); setShowAdmin(false); window.location.reload(); }} className="w-full py-7 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl shadow-blue-600/30">SAVE & REBOOT NEURAL HUB</button>
          </div>
        </div>
      )}

      {selectedArtifact && (
        <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 overflow-y-auto animate-fade-in" onClick={() => setSelectedArtifact(null)}>
           <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-start" onClick={e => e.stopPropagation()}>
              <div className="lg:col-span-7 aspect-[3/4] bg-zinc-950 rounded-[3rem] overflow-hidden border border-zinc-800 shadow-2xl relative"><img src={selectedArtifact.image} className="w-full h-full object-cover" /></div>
              <div className="lg:col-span-5 space-y-12 py-10">
                 <div className="flex justify-between items-start">
                    <div><h2 className="text-5xl font-orbitron font-black text-white italic uppercase tracking-tighter leading-none">{selectedArtifact.name}</h2><div className="flex items-center space-x-3 mt-4"><div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">{selectedArtifact.userProfile?.avatar_url ? <img src={selectedArtifact.userProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black">{selectedArtifact.userProfile?.display_name?.[0] || 'P'}</div>}</div><span className="text-xs font-black text-zinc-500 uppercase tracking-widest">{selectedArtifact.userProfile?.display_name || 'PILOT'}</span></div></div>
                    <button onClick={() => setSelectedArtifact(null)} className="p-4 bg-zinc-900 rounded-full hover:bg-zinc-800 text-zinc-400"><i className="fa-solid fa-times text-xl"></i></button>
                 </div>
                 <div className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-zinc-800/60 space-y-8 backdrop-blur-md relative overflow-hidden">
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-bold uppercase italic relative z-10">{selectedArtifact.description}</p>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <button 
                          onClick={(e) => handleLike(e, selectedArtifact!.id)} 
                          className="flex items-center justify-center space-x-3 py-5 bg-zinc-950 border border-zinc-800 rounded-2xl active:scale-95 group transition-all"
                        >
                          <i className={`fa-solid fa-bolt text-lg ${selectedArtifact.userHasLiked ? 'text-blue-500' : 'text-zinc-700 group-hover:text-blue-400'}`}></i>
                          <span className="text-[11px] font-black uppercase text-zinc-400">{selectedArtifact.likeCount || 0} Synergy</span>
                        </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
      <footer className="py-20 text-center border-t border-zinc-900 text-zinc-800 text-[11px] font-black uppercase tracking-[0.6em] bg-black/80 backdrop-blur-xl">© 2024 FOR THE COS. DIMENSIONS SYNERGIZED VIA n8n NEURAL HUB.</footer>
    </div>
  );
};

export default App;
