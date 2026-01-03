
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toPng } from 'html-to-image';
import { AppStep, AppState, Category, Subcategory, CardStats, AdminSettings, SavedGeneration, ImageTransform, PhysicalOrder, User, UserProfile } from './types';
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
  getProfileById, 
  getPublicGenerations, 
  toggleLike, 
  getSupabase,
  getAllProfiles,
  updateGenerationVisibility
} from './services/db';

const ADMIN_EMAIL_LOWER = "roarshackstudios@gmail.com";

const App: React.FC = () => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [checkoutSnapshots, setCheckoutSnapshots] = useState<string[]>([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [isPreparingOrder, setIsPreparingOrder] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {
    const saved = localStorage.getItem('cos-admin-settings');
    const defaults = {
      defaultTitle: "THE LEGENDARY",
      defaultDescription: "Bring your character to life with cinematic scenery and professional lighting effects.",
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
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedArtifact, setSelectedArtifact] = useState<SavedGeneration | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  const brandLogoUrl = "https://i.ibb.co/5g6SRmrF/2c7b3081-ab1b-4d89-b6b5-01abcc0942ef.png";
  const loaderLogoUrl = "https://i.ibb.co/b43T8dM/1.png";
  const isSupabaseConfigured = getSupabase() !== null;

  const defaultTransform: ImageTransform = { scale: 1, offset: { x: 0, y: 0 }, flipH: false, flipV: false };

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
    stats: { strength: 5, intelligence: 6, agility: 5, speed: 5 },
    characterName: '',
    characterDescription: '',
    cardStatusText: 'MASTER CRAFTSMAN',
    styleIntensity: 80, 
    comicTransform: { ...defaultTransform },
    cardTransform: { ...defaultTransform },
    cardBackTransform: { ...defaultTransform },
    titleOffset: { x: 0, y: 0 },
    showPriceBadge: true,
    showBrandLogo: true,
    isPublic: true,
    error: null,
    editingId: null
  });

  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<'pan' | 'zoom'>('pan');
  const [activeSliderTool, setActiveSliderTool] = useState<'scale' | 'posX' | 'posY'>('scale');

  const isAdmin = useMemo(() => (state.currentUser?.email?.toLowerCase() === ADMIN_EMAIL_LOWER) || !isSupabaseConfigured || (!state.currentUser), [state.currentUser, isSupabaseConfigured]);

  const loadGallery = async (userId: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const generations = await getAllGenerations(userId);
      setGalleryItems(generations);
    } catch (e: any) {
      console.warn("Gallery load failed:", e.message);
    }
  };

  const loadProfiles = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const profiles = await getAllProfiles();
      setAllProfiles(profiles);
    } catch (e) {
      console.warn("Profiles load failed");
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
          loadProfiles();
        } catch (e) {
          console.error("Core sync failure:", e);
        }
      }
    };
    init();
  }, [isSupabaseConfigured]);

  const refreshFeed = async (userId?: string) => {
    if (!isSupabaseConfigured) return;
    try {
      const currentUserId = userId || state.currentUser?.id;
      const feed = await getPublicGenerations(currentUserId);
      setPublicFeed(feed);
    } catch (e: any) {
      console.warn("Feed update failed:", e.message);
    }
  };

  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isSupabaseConfigured) {
      setState(prev => ({ ...prev, error: "CLOUD CORE OFFLINE! Open Setup Panel to connect Supabase." }));
      setShowAdmin(true);
      return; 
    }
    if (!authEmail || !authPassword) {
      setState(prev => ({ ...prev, error: "INPUT IDENTITY DATA FIRST!" }));
      return;
    }
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
      loadProfiles();
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || "AUTHENTICATION FAILED!" }));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestLogin = () => {
    const guestUser: User = { id: 'guest-' + Date.now(), email: 'guest@hero.com' };
    setState(prev => ({ 
      ...prev, 
      currentUser: guestUser, 
      step: AppStep.STUDIO,
      error: null 
    }));
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
        characterName: `${state.selectedSubcategory?.name || 'Hero'}`,
        characterDescription: adminSettings.defaultDescription,
        editingId: null
      }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message || String(err), step: AppStep.STUDIO }));
    }
  };

  const saveToHistory = async (forceVisibility?: boolean): Promise<string | null> => {
    if (!state.resultImage || isSaving || !state.currentUser) return null;
    if (state.currentUser.id.startsWith('guest')) {
      alert("DEMO MODE: Saving is disabled for guest heroes. Connect Supabase to save!");
      return null;
    }
    setIsSaving(true);
    try {
      const newId = state.editingId || crypto.randomUUID();
      const visibility = forceVisibility !== undefined ? forceVisibility : state.isPublic;
      // Fix: Line 244 replaced 'gen.category' with 'state.selectedCategory?.name || 'Custom''
      await saveGeneration({
        id: newId,
        userId: state.currentUser.id,
        timestamp: Date.now(),
        image: state.resultImage, 
        name: state.characterName,
        category: state.selectedCategory?.name || 'Custom',
        type: state.isComicStyled ? 'comic' : (state.isCardStyled ? 'card' : 'raw'),
        stats: state.stats || undefined,
        description: state.characterDescription,
        cardStatusText: state.cardStatusText,
        originalSourceImage: state.sourceImage || undefined,
        isPublic: visibility,
        comicTransform: state.comicTransform,
        cardTransform: state.cardTransform,
        cardBackTransform: state.cardBackTransform,
        titleOffset: state.titleOffset,
        showPriceBadge: state.showPriceBadge,
        showBrandLogo: state.showBrandLogo
      });
      await loadGallery(state.currentUser.id);
      if (visibility) await refreshFeed();
      alert(state.editingId ? "HERO UPDATED!" : "HERO SAVED TO VAULT!");
      return newId;
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditHero = (item: SavedGeneration) => {
    setIsFlipped(false);
    const oldStats = item.stats as any;
    const mappedStats: CardStats = {
      strength: oldStats?.strength || 5,
      intelligence: oldStats?.intelligence || 5,
      agility: oldStats?.agility || oldStats?.mental || 5,
      speed: oldStats?.speed || 5
    };

    setState(prev => ({
      ...prev,
      step: AppStep.RESULT,
      resultImage: item.image,
      sourceImage: item.originalSourceImage || item.image,
      characterName: item.name,
      characterDescription: item.description || '',
      isComicStyled: item.type === 'comic',
      isCardStyled: item.type === 'card',
      stats: mappedStats,
      comicTransform: item.comicTransform || { ...defaultTransform },
      cardTransform: item.cardTransform || { ...defaultTransform },
      cardBackTransform: item.cardBackTransform || { ...defaultTransform },
      titleOffset: item.titleOffset || { x: 0, y: 0 },
      showPriceBadge: item.showPriceBadge !== undefined ? item.showPriceBadge : true,
      showBrandLogo: item.showBrandLogo !== undefined ? item.showBrandLogo : true,
      isPublic: item.isPublic || false,
      editingId: item.id,
      selectedCategory: CATEGORIES.find(c => c.name === item.category) || null
    }));
    setSelectedArtifact(null);
  };

  const togglePublicStatus = async (item: SavedGeneration) => {
    const newStatus = !item.isPublic;
    try {
      await updateGenerationVisibility(item.id, newStatus);
      if (state.currentUser) await loadGallery(state.currentUser.id);
      await refreshFeed();
      if (selectedArtifact?.id === item.id) {
        setSelectedArtifact({ ...selectedArtifact, isPublic: newStatus });
      }
    } catch (err) {
      console.error("Failed to update visibility");
    }
  };

  const handleDeleteHero = async (id: string) => {
    if (!window.confirm("PERMANENTLY REMOVE THIS HERO FROM THE VAULT?")) return;
    try {
      await deleteGeneration(id);
      if (state.currentUser) await loadGallery(state.currentUser.id);
      await refreshFeed();
      setSelectedArtifact(null);
    } catch (err: any) {
      alert("DELETION FAILED: " + err.message);
    }
  };

  const handleDownload = async (label: string, forceSide?: 'front' | 'back') => {
    if (!previewRef.current || isDownloading) return;
    setIsDownloading(true);
    
    const originalFlipped = isFlipped;
    try {
      if (forceSide === 'front' && originalFlipped) {
        setIsFlipped(false);
        await new Promise(r => setTimeout(r, 400));
      } else if (forceSide === 'back' && !originalFlipped) {
        setIsFlipped(true);
        await new Promise(r => setTimeout(r, 400));
      }

      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      const namePart = (state.characterName || selectedArtifact?.name || 'hero').replace(/\s+/g, '-').toLowerCase();
      link.download = `${namePart}-${label}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to generate digital file.");
    } finally {
      if (forceSide && isFlipped !== originalFlipped) {
        setIsFlipped(originalFlipped);
      }
      setIsDownloading(false);
    }
  };

  const handlePhysicalOrderStart = async () => {
    if (!previewRef.current) return;
    setIsPreparingOrder(true);
    try {
      const snapshots: string[] = [];

      if (state.isCardStyled) {
        setIsFlipped(false);
        await new Promise(r => setTimeout(r, 800));
        const front = await toPng(previewRef.current, { cacheBust: true });
        snapshots.push(front);

        setIsFlipped(true);
        await new Promise(r => setTimeout(r, 800));
        const back = await toPng(previewRef.current, { cacheBust: true });
        snapshots.push(back);
      } else {
        await new Promise(r => setTimeout(r, 300));
        const single = await toPng(previewRef.current, { cacheBust: true });
        snapshots.push(single);
      }

      setCheckoutSnapshots(snapshots);
      setState(prev => ({ ...prev, step: AppStep.CHECKOUT }));
      setSelectedArtifact(null);
    } catch (err) {
      console.error("Snapshot failed:", err);
      alert("Failed to prepare your order.");
    } finally {
      setIsPreparingOrder(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!state.currentUser || checkoutSnapshots.length === 0) return;
    setIsProcessingOrder(true);
    try {
      const orderId = crypto.randomUUID();
      const itemType = state.isCardStyled ? 'TRADING CARD SET' : 'COMIC PRINT';
      const amount = state.isCardStyled ? adminSettings.priceCardSet : adminSettings.priceComicPrint;
      
      await saveOrder({
        id: orderId,
        userId: state.currentUser.id,
        timestamp: Date.now(),
        paypalOrderId: 'MOCK-' + Date.now(),
        itemType: itemType,
        itemName: state.characterName,
        amount: amount,
        status: 'PAID',
        previewImage: checkoutSnapshots[0]
      });
      
      setIsPaymentSuccess(true);
    } catch (err: any) {
      alert("Order process failed: " + err.message);
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const goBack = () => {
    setIsFlipped(false);
    if (state.step === AppStep.CATEGORY_SELECT) setState(prev => ({ ...prev, step: AppStep.STUDIO }));
    else if (state.step === AppStep.SUBCATEGORY_SELECT) setState(prev => ({ ...prev, step: AppStep.CATEGORY_SELECT }));
    else if (state.step === AppStep.RESULT) setState(prev => ({ ...prev, step: AppStep.SUBCATEGORY_SELECT }));
    else if (state.step === AppStep.CHECKOUT) setState(prev => ({ ...prev, step: AppStep.RESULT }));
  };

  const handleLike = async (e: React.MouseEvent, generationId: string) => {
    e.stopPropagation();
    if (!state.currentUser || !isSupabaseConfigured) {
      setState(prev => ({ ...prev, error: "LOG IN TO LIKE HEROES!" }));
      if (!state.currentUser) setState(prev => ({ ...prev, step: AppStep.LOGIN }));
      return;
    }
    try {
      const liked = await toggleLike(state.currentUser.id, generationId);
      const updateList = (list: SavedGeneration[]) => list.map(item => {
        if (item.id === generationId) {
          return {
            ...item,
            userHasLiked: liked,
            likeCount: (item.likeCount || 0) + (liked ? 1 : -1)
          };
        }
        return item;
      });
      setPublicFeed(prev => updateList(prev));
      setGalleryItems(prev => updateList(prev));
      if (selectedArtifact && selectedArtifact.id === generationId) {
        setSelectedArtifact(prev => prev ? {
          ...prev,
          userHasLiked: liked,
          likeCount: (prev.likeCount || 0) + (liked ? 1 : -1)
        } : null);
      }
    } catch (err: any) {
      console.error("Like toggle failed:", err);
    }
  };

  const activeTransform = useMemo(() => {
    if (state.isCardStyled) {
      return isFlipped ? state.cardBackTransform : state.cardTransform;
    }
    return state.comicTransform;
  }, [state.isCardStyled, isFlipped, state.cardTransform, state.cardBackTransform, state.comicTransform]);

  const updateActiveTransform = (updates: Partial<ImageTransform>) => {
    const key = state.isCardStyled 
      ? (isFlipped ? 'cardBackTransform' : 'cardTransform') 
      : 'comicTransform';
      
    setState(p => ({
        ...p,
        [key]: { ...p[key], ...updates }
    }));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (state.step !== AppStep.RESULT || e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    if (activeTool === 'pan') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const percentX = (dx / rect.width) * 100;
      const percentY = (dy / rect.height) * 100;
      updateActiveTransform({
        offset: {
          x: activeTransform.offset.x + percentX,
          y: activeTransform.offset.y + percentY
        }
      });
    } else if (activeTool === 'zoom') {
      const zoomFactor = -dy * 0.01;
      const newScale = Math.min(Math.max(0.1, activeTransform.scale + zoomFactor), 10);
      updateActiveTransform({ scale: newScale });
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const resetTransform = () => {
    updateActiveTransform({ scale: 1, offset: { x: 0, y: 0 }, flipH: false, flipV: false });
  };

  const renderArtifactCard = (item: SavedGeneration) => (
    <div key={item.id} className="bg-white p-2 border-4 border-black shadow-[10px_10px_0px_#660000] group hover:-translate-y-2 transition-all duration-200">
      <div className="aspect-[3/4] relative bg-black overflow-hidden cursor-pointer" onClick={() => { setIsFlipped(false); setSelectedArtifact(item); }}>
        <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={item.name} />
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className={`px-4 py-1 font-comic text-xl uppercase border-4 border-black shadow-lg ${item.type === 'comic' ? 'bg-[#e21c23] text-white' : (item.type === 'card' ? 'bg-[#fde910] text-black' : 'bg-black text-white')}`}>
            {item.type}
          </span>
          {state.currentUser?.id === item.userId && (
            <span className={`px-4 py-1 font-comic text-xs uppercase border-4 border-black shadow-lg ${item.isPublic ? 'bg-green-500 text-white' : 'bg-zinc-500 text-white'}`}>
              {item.isPublic ? 'HEROIC (PUBLIC)' : 'SNEAKY (PRIVATE)'}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 flex flex-col space-y-2 bg-white text-black">
        <h4 className="font-comic text-3xl uppercase truncate tracking-tight leading-none italic">{item.name}</h4>
        <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">By {item.userProfile?.display_name || 'Hero'}</span>
            <button onClick={(e) => handleLike(e, item.id)} className="text-[#e21c23] hover:scale-125 transition-transform">
                <i className={`fa-solid fa-heart ${item.userHasLiked ? 'text-[#e21c23]' : 'text-zinc-300'}`}></i> {item.likeCount || 0}
            </button>
        </div>
      </div>
    </div>
  );

  const renderCreatorBadge = (profile: UserProfile) => (
    <div key={profile.id} className="flex flex-col items-center space-y-4 group cursor-pointer" onClick={() => {}}>
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-8 border-black overflow-hidden shadow-[8px_8px_0px_#660000] group-hover:-translate-y-2 transition-transform">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#fde910] flex items-center justify-center text-4xl font-black">
            {profile.display_name?.[0] || profile.email[0].toUpperCase()}
          </div>
        )}
      </div>
      <span className="font-comic text-2xl uppercase tracking-tighter truncate w-32 text-center drop-shadow-sm">{profile.display_name || profile.email.split('@')[0]}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {isPreparingOrder && (
        <div className="fixed inset-0 z-[1000] bg-black/90 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
          <div className="relative group">
            <div className="absolute inset-0 bg-white opacity-20 blur-3xl rounded-full scale-150 group-hover:scale-175 transition-transform duration-1000 animate-pulse"></div>
            <img src={loaderLogoUrl} className="w-48 h-48 md:w-64 md:h-64 object-contain animate-heartbeat relative z-10" alt="Preparing..." />
          </div>
          <div className="mt-16 text-center">
            <h2 className="text-6xl md:text-8xl font-comic comic-text-yellow animate-bounce">DEVELOPING ARTIFACT!</h2>
            <p className="text-white font-black text-2xl md:text-3xl uppercase tracking-widest italic opacity-80">STAY ALERT, HERO...</p>
          </div>
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-[100] flex justify-between items-center px-10 py-6 bg-white border-b-8 border-black shadow-xl">
        <div className="flex items-center cursor-pointer" onClick={() => { setIsFlipped(false); setState(prev => ({ ...prev, step: AppStep.HOME })); }}>
          <img src={brandLogoUrl} className="h-14 object-contain" alt="Brand Logo" />
        </div>
        <div className="flex items-center space-x-10">
          <button onClick={() => { setIsFlipped(false); setState(prev => ({ ...prev, step: AppStep.COMMUNITY })); }} className={`text-2xl font-comic uppercase tracking-wider transition-all ${state.step === AppStep.COMMUNITY ? 'text-[#e21c23] scale-110' : 'text-black hover:text-[#e21c23]'}`}>Feed</button>
          {state.currentUser ? (
            <>
              <button onClick={() => { setIsFlipped(false); setState(prev => ({ ...prev, step: AppStep.STUDIO })); }} className={`text-2xl font-comic uppercase tracking-wider transition-all ${state.step === AppStep.STUDIO ? 'text-[#e21c23] scale-110' : 'text-black hover:text-[#e21c23]'}`}>Create</button>
              <button onClick={() => { setIsFlipped(false); setState(prev => ({ ...prev, step: AppStep.GALLERY })); }} className={`text-2xl font-comic uppercase tracking-wider transition-all ${state.step === AppStep.GALLERY ? 'text-[#e21c23] scale-110' : 'text-black hover:text-[#e21c23]'}`}>Gallery</button>
              <div className="w-12 h-12 bg-black border-4 border-black rounded-full overflow-hidden">
                {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-black">{state.currentUser.id.startsWith('guest') ? 'G' : '?'}</div>}
              </div>
            </>
          ) : (
            <button onClick={() => { setIsFlipped(false); setState(prev => ({ ...prev, step: AppStep.LOGIN })); }} className="action-btn-red text-sm">Join / Login</button>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col pt-32 bg-white">
        {state.step === AppStep.HOME && (
          <div className="flex flex-col animate-fade-in">
             <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
                <div className="relative space-y-16">
                  <div className="speech-bubble inline-block animate-kaboom">
                    <p className="text-3xl font-comic uppercase tracking-widest text-[#e21c23]">SUPERCHARGE YOUR CHARACTER!</p>
                  </div>
                  <h2 className="text-[12rem] md:text-[18rem] font-comic italic uppercase tracking-tighter leading-[0.75] select-none -skew-x-12">
                    <span className="comic-text-3xl block text-black">FOR THE</span>
                    <span className="comic-text-3d block transform scale-110">COSPLAY</span>
                  </h2>
                  <div className="flex flex-wrap justify-center gap-12 pt-16">
                    <button onClick={() => setState(prev => ({ ...prev, step: state.currentUser ? AppStep.STUDIO : AppStep.LOGIN }))} className="action-btn-red px-28 py-8 text-4xl">START THE ACTION!</button>
                    <button onClick={() => setState(prev => ({ ...prev, step: AppStep.COMMUNITY }))} className="action-btn-yellow px-24 py-8 text-4xl">VIEW GALLERY</button>
                  </div>
                </div>
             </section>
             <section className="p-16 md:p-32 bg-[#f4f4f4] border-t-8 border-black">
                <h3 className="text-7xl font-comic italic uppercase mb-16 comic-text-3d">FEATURED <span className="text-black">CREATORS</span></h3>
                <div className="flex space-x-16 overflow-x-auto pb-10 custom-scrollbar">
                  {allProfiles.length > 0 ? allProfiles.map(renderCreatorBadge) : <div className="text-zinc-300 font-comic text-4xl">Enlisting heroes...</div>}
                </div>
             </section>
             <section className="p-16 md:p-32 space-y-24 bg-white border-t-8 border-black">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-16">
                  {publicFeed.length > 0 ? publicFeed.slice(0, 8).map(renderArtifactCard) : <div className="col-span-full py-40 text-center text-black/10 font-comic text-7xl italic">Empty panels...</div>}
                </div>
             </section>
          </div>
        )}

        {state.step === AppStep.STUDIO && <div className="animate-fade-in flex flex-col items-center justify-center py-40 px-6">
          <div className="text-center space-y-10 transform -rotate-1 mb-24">
            <h2 className="text-[14rem] font-comic text-black italic uppercase tracking-tighter leading-none comic-text-3d">THE <br/><span className="text-[#fde910]">STUDIO</span></h2>
          </div>
          <div className="w-full max-w-6xl"><PhotoStep onPhotoSelected={handlePhotoSelected} /></div>
        </div>}

        {state.step === AppStep.RESULT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 animate-fade-in bg-zinc-100 min-h-[calc(100vh-8rem)]">
            <div className="lg:col-span-9 bg-zinc-100 flex flex-col border-r-8 border-black">
               {/* Style Switcher */}
               <div className="bg-black p-2 flex space-x-3 border-b-4 border-black">
                  {['raw', 'comic', 'card'].map(type => (
                    <button key={type} onClick={() => { setIsFlipped(false); setState(p => ({ ...p, isComicStyled: type==='comic', isCardStyled: type==='card' })); }} className={`flex-grow py-3 text-xl font-comic uppercase transition-all ${((type==='comic' && state.isComicStyled) || (type==='card' && state.isCardStyled) || (type==='raw' && !state.isComicStyled && !state.isCardStyled)) ? 'bg-[#fde910] text-black' : 'text-zinc-600 hover:text-white'}`}>{type}</button>
                  ))}
               </div>

               {/* Redesigned Pro Toolbar */}
               <div className="bg-black text-white px-6 py-4 flex flex-col gap-4 border-b-4 border-black sticky top-0 z-50">
                  <div className="flex items-center justify-between w-full flex-wrap gap-4">
                    <div className="flex items-center gap-6">
                      {/* General Tools */}
                      <div className="flex items-center gap-2 border-r border-zinc-700 pr-6 shrink-0">
                        <button onClick={() => setActiveTool('pan')} className={`p-3 rounded transition-colors ${activeTool === 'pan' ? 'bg-[#fde910] text-black' : 'text-zinc-400 hover:text-white'}`} title="Pan Tool"><i className="fa-solid fa-arrows-up-down-left-right text-xl"></i></button>
                        <button onClick={() => setActiveTool('zoom')} className={`p-3 rounded transition-colors ${activeTool === 'zoom' ? 'bg-[#fde910] text-black' : 'text-zinc-400 hover:text-white'}`} title="Zoom Tool"><i className="fa-solid fa-magnifying-glass-plus text-xl"></i></button>
                        <button onClick={resetTransform} className="p-3 text-zinc-400 hover:text-white transition-colors" title="Reset View"><i className="fa-solid fa-rotate-left text-xl"></i></button>
                      </div>

                      {/* Tool Selectors (Provided Icons) - Clustered together, no borders/shadows */}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <button onClick={() => setActiveSliderTool('scale')} className={`w-14 h-14 p-1 transition-all flex items-center justify-center border-0 ${activeSliderTool === 'scale' ? 'bg-[#fde910] scale-110' : 'opacity-60 hover:opacity-100'}`}>
                            <img src="https://i.ibb.co/nMRXHpr3/scale.png" className="w-full h-full object-contain" alt="Scale Tool" />
                          </button>
                        </div>
                        <div className="flex flex-col items-center">
                          <button onClick={() => setActiveSliderTool('posX')} className={`w-14 h-14 p-1 transition-all flex items-center justify-center border-0 ${activeSliderTool === 'posX' ? 'bg-[#fde910] scale-110' : 'opacity-60 hover:opacity-100'}`}>
                            <img src="https://i.ibb.co/N6600kXX/Asset-3.png" className="w-full h-full object-contain" alt="Move X Tool" />
                          </button>
                        </div>
                        <div className="flex flex-col items-center">
                          <button onClick={() => setActiveSliderTool('posY')} className={`w-14 h-14 p-1 transition-all flex items-center justify-center border-0 ${activeSliderTool === 'posY' ? 'bg-[#fde910] scale-110' : 'opacity-60 hover:opacity-100'}`}>
                            <img src="https://i.ibb.co/xt78wwTL/vert.png" className="w-full h-full object-contain" alt="Move Y Tool" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 border-l border-zinc-700 pl-6">
                      <button onClick={() => updateActiveTransform({ flipH: !activeTransform.flipH })} className={`px-4 py-2 text-[10px] font-black uppercase border-2 transition-colors ${activeTransform.flipH ? 'bg-white text-black border-white' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>FLIP H</button>
                      <button onClick={() => updateActiveTransform({ flipV: !activeTransform.flipV })} className={`px-4 py-2 text-[10px] font-black uppercase border-2 transition-colors ${activeTransform.flipV ? 'bg-white text-black border-white' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>FLIP V</button>
                      <button onClick={resetTransform} className="px-4 py-2 text-[10px] font-black uppercase text-red-500 border-2 border-red-500/20 hover:bg-red-500 hover:text-white transition-all">CLEAR ALL</button>
                    </div>
                  </div>

                  {/* Dynamic Slider Section */}
                  <div className="bg-zinc-900/80 p-3 border border-zinc-800 min-h-[50px] flex items-center">
                    {activeSliderTool === 'scale' && (
                      <div className="flex items-center gap-6 w-full animate-fade-in">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 w-24">SCALE</span>
                        <input type="range" min="0.1" max="10" step="0.01" value={activeTransform.scale} onChange={e => updateActiveTransform({ scale: parseFloat(e.target.value) })} className="flex-grow h-1.5 bg-zinc-800 rounded-none appearance-none accent-[#fde910]" />
                        <span className="text-[10px] font-mono text-zinc-400 w-12 text-right">{activeTransform.scale.toFixed(1)}x</span>
                      </div>
                    )}
                    {activeSliderTool === 'posX' && (
                      <div className="flex items-center gap-6 w-full animate-fade-in">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 w-24">POS X</span>
                        <input type="range" min="-200" max="200" step="0.5" value={activeTransform.offset.x} onChange={e => updateActiveTransform({ offset: { ...activeTransform.offset, x: parseFloat(e.target.value) } })} className="flex-grow h-1.5 bg-zinc-800 rounded-none appearance-none accent-[#fde910]" />
                        <span className="text-[10px] font-mono text-zinc-400 w-12 text-right">{Math.round(activeTransform.offset.x)}%</span>
                      </div>
                    )}
                    {activeSliderTool === 'posY' && (
                      <div className="flex items-center gap-6 w-full animate-fade-in">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 w-24">POS Y</span>
                        <input type="range" min="-200" max="200" step="0.5" value={activeTransform.offset.y} onChange={e => updateActiveTransform({ offset: { ...activeTransform.offset, y: parseFloat(e.target.value) } })} className="flex-grow h-1.5 bg-zinc-800 rounded-none appearance-none accent-[#fde910]" />
                        <span className="text-[10px] font-mono text-zinc-400 w-12 text-right">{Math.round(activeTransform.offset.y)}%</span>
                      </div>
                    )}
                  </div>
               </div>

               {state.isCardStyled && (
                 <div className="flex justify-center pt-8 px-6">
                    <button onClick={() => setIsFlipped(!isFlipped)} className="w-full max-w-3xl py-4 font-comic text-2xl uppercase border-4 border-black bg-zinc-900 text-[#fde910] shadow-[8px_8px_0px_#660000] active:translate-y-1 active:shadow-none transition-all">
                        {isFlipped ? 'VIEW FRONT' : 'VIEW BACK'}
                    </button>
                 </div>
               )}

               <div className={`flex-grow flex flex-col items-center justify-start pt-8 pb-12 px-4 lg:px-12 touch-none select-none ${isDragging ? 'cursor-grabbing' : (activeTool === 'pan' ? 'cursor-grab' : 'cursor-zoom-in')}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
                  <div ref={previewRef} className="w-full max-w-3xl aspect-[3/4] relative shadow-[30px_30px_0px_rgba(0,0,0,0.1)] bg-black group/preview border-[10px] border-black overflow-hidden transition-all pointer-events-none">
                     {state.isCardStyled ? (
                       <TradingCard frontImage={state.resultImage!} backImage={state.sourceImage!} stats={state.stats || {strength:5,intelligence:5,agility:5,speed:5}} characterName={state.characterName} characterDescription={state.characterDescription} category={state.selectedCategory?.name || 'HERO'} isFlipped={isFlipped} onFlip={() => {}} imageScale={state.cardTransform.scale} imageOffset={state.cardTransform.offset} flipH={state.cardTransform.flipH} flipV={state.cardTransform.flipV} backImageScale={state.cardBackTransform.scale} backImageOffset={state.cardBackTransform.offset} backFlipH={state.cardBackTransform.flipH} backFlipV={state.cardBackTransform.flipV} />
                     ) : (
                       <div className="w-full h-full relative overflow-hidden bg-black">
                          <img src={state.resultImage!} className="w-full h-full object-cover origin-center" style={{ transform: `translate(${state.comicTransform.offset.x}%, ${state.comicTransform.offset.y}%) scale(${state.comicTransform.scale * (state.comicTransform.flipH ? -1 : 1)}, ${state.comicTransform.scale * (state.comicTransform.flipV ? -1 : 1)})` }} />
                          {state.isComicStyled && <ComicFrame category={state.selectedCategory?.name || 'LEGEND'} subcategory={state.selectedSubcategory?.name || 'HERO'} customTitle={state.characterName} titleOffset={state.titleOffset} showPriceBadge={state.showPriceBadge} showBrandLogo={state.showBrandLogo} />}
                       </div>
                     )}
                  </div>
               </div>
            </div>
            
            <div className="lg:col-span-3 bg-white flex flex-col border-l-8 border-black text-black overflow-y-auto custom-scrollbar h-full">
               <div className="p-8 space-y-12 pb-24">
                 <div className="flex items-center space-x-4"><h3 className="text-6xl font-comic italic uppercase tracking-tighter -skew-x-12 comic-text-3d">DATA <span className="text-[#fde910]">LOG</span></h3></div>
                 
                 <div className="space-y-12">
                    <div className="space-y-6 bg-zinc-50 p-6 border-4 border-black shadow-[8px_8px_0px_#660000]">
                      <p className="text-xl font-comic uppercase tracking-widest text-[#e21c23]">ID PROFILE</p>
                      <input type="text" placeholder="IDENTITY NAME" value={state.characterName} onChange={e => setState(p => ({ ...p, characterName: e.target.value }))} className="w-full bg-white border-4 border-black px-4 py-3 text-lg font-bold uppercase outline-none focus:bg-yellow-50" />
                      <textarea placeholder="CHARACTER ORIGIN" value={state.characterDescription} onChange={e => setState(p => ({ ...p, characterDescription: e.target.value }))} className="w-full bg-white border-4 border-black px-4 py-3 text-base font-medium outline-none h-32 resize-none focus:bg-yellow-50" />
                    </div>

                    {state.isCardStyled && (
                      <div className="space-y-6 bg-zinc-50 p-6 border-4 border-black shadow-[8px_8px_0px_#660000]">
                        <p className="text-xl font-comic uppercase tracking-widest text-[#e21c23] italic">POWER GRID</p>
                        <div className="bg-white p-4 border-4 border-black shadow-[6px_6px_0px_#660000] space-y-4">
                          {['strength', 'intelligence', 'agility', 'speed'].map(stat => (
                            <div key={stat} className="space-y-2">
                              <div className="flex justify-between items-center"><label className="text-xs font-black uppercase">{stat}</label><span className="text-xs font-bold">{(state.stats as any)[stat]}/7</span></div>
                              <input type="range" min="1" max="7" step="1" value={(state.stats as any)[stat]} onChange={e => setState(p => ({ ...p, stats: { ...p.stats!, [stat]: parseInt(e.target.value) } }))} className="w-full h-1 bg-black rounded-none appearance-none cursor-pointer accent-[#3b82f6]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-6 bg-zinc-50 p-6 border-4 border-black shadow-[8px_8px_0px_#660000]">
                      <p className="text-xl font-comic uppercase tracking-widest text-[#e21c23] italic">DIGITAL ASSETS</p>
                      <div className="flex flex-col gap-4">
                        {state.isCardStyled ? (
                          <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handleDownload('card-front', 'front')} disabled={isDownloading} className="action-btn-yellow !py-4 !text-xl flex-grow"><i className="fa-solid fa-download mr-2"></i>FRONT</button>
                            <button onClick={() => handleDownload('card-back', 'back')} disabled={isDownloading} className="action-btn-yellow !py-4 !text-xl flex-grow"><i className="fa-solid fa-download mr-2"></i>BACK</button>
                          </div>
                        ) : (
                          <button onClick={() => handleDownload(state.isComicStyled ? 'comic-cover' : 'raw-hero')} disabled={isDownloading} className="action-btn-yellow !py-5 !text-2xl w-full">
                            <i className="fa-solid fa-download mr-3"></i>SAVE {state.isComicStyled ? 'COMIC COVER' : 'RAW IMAGE'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 bg-zinc-50 p-6 border-4 border-black shadow-[8px_8px_0px_#660000]">
                      <p className="text-xl font-comic uppercase tracking-widest text-[#e21c23] italic">PUBLICATION</p>
                      <div className="bg-white p-4 border-4 border-black shadow-[6px_6px_0px_#660000] space-y-4">
                        {state.isComicStyled && (
                          <>
                            <label className="flex items-center space-x-4 cursor-pointer"><input type="checkbox" checked={state.showPriceBadge} onChange={e => setState(p => ({ ...p, showPriceBadge: e.target.checked }))} className="w-6 h-6 border-4 border-black accent-[#e21c23]" /><span className="text-lg font-comic uppercase">Price Badge</span></label>
                            <label className="flex items-center space-x-4 cursor-pointer"><input type="checkbox" checked={state.showBrandLogo} onChange={e => setState(p => ({ ...p, showBrandLogo: e.target.checked }))} className="w-6 h-6 border-4 border-black accent-[#e21c23]" /><span className="text-lg font-comic uppercase">Brand Logo</span></label>
                          </>
                        )}
                        <label className="flex items-center space-x-4 cursor-pointer pt-2 border-t border-zinc-200"><input type="checkbox" checked={state.isPublic} onChange={e => setState(p => ({ ...p, isPublic: e.target.checked }))} className="w-6 h-6 border-4 border-black accent-[#22c55e]" /><span className="text-lg font-comic uppercase text-green-600">Global Feed</span></label>
                      </div>
                    </div>
                 </div>

                 <div className="flex flex-col space-y-4 pt-10 border-t-8 border-black">
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => saveToHistory()} disabled={isSaving} className="action-btn-red !py-6 !text-3xl flex-grow">{state.editingId ? 'UPDATE' : 'SAVE'}</button>
                      {!state.isPublic && <button onClick={() => saveToHistory(true)} disabled={isSaving} className="action-btn-yellow !py-6 !text-3xl flex-grow">SAVE & POST</button>}
                    </div>
                    {(state.isComicStyled || state.isCardStyled) && (
                      <button onClick={handlePhysicalOrderStart} className="action-btn-red !bg-[#e21c23] !text-black w-full !text-4xl !py-8">GET PHYSICAL PRINT!</button>
                    )}
                    <button onClick={() => { setIsFlipped(false); setState(p => ({ ...p, step: AppStep.STUDIO, resultImage: null, editingId: null })); }} className="w-full text-xl font-comic uppercase tracking-widest text-zinc-500 hover:text-red-600 py-6 transition-colors">ABORT MISSION</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {state.step === AppStep.CHECKOUT && (
          <div className="max-w-7xl w-full mx-auto p-8 md:p-16 animate-fade-in flex flex-col items-center">
            {isPaymentSuccess ? (
              <div className="text-center space-y-16 py-32 animate-kaboom">
                 <h2 className="text-9xl font-comic comic-text-3d uppercase">MISSION SUCCESS!</h2>
                 <p className="text-3xl font-black uppercase tracking-widest">Your physical artifacts are being manufactured.</p>
                 <button onClick={() => setState(p => ({ ...p, step: AppStep.GALLERY }))} className="action-btn-yellow text-4xl">VIEW YOUR VAULT</button>
              </div>
            ) : (
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
                <div className="lg:col-span-7 space-y-8">
                  <div className="grid grid-cols-1 gap-10">
                    {checkoutSnapshots.map((snap, i) => (
                      <div key={i} className="bg-white p-3 shadow-[25px_25px_0px_#660000] relative group max-w-[75%] mx-auto">
                        <img src={snap} className="w-full h-auto" />
                        <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 font-comic text-xs uppercase border-2 border-white">{checkoutSnapshots.length > 1 ? (i === 0 ? 'FRONT' : 'BACK') : 'ARTIFACT'}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-5 space-y-12 text-black bg-white p-8 lg:p-12 border-8 border-black shadow-[25px_25px_0px_#660000]">
                  <h2 className="text-6xl lg:text-7xl font-comic italic uppercase tracking-tighter comic-text-3d pt-4">ACQUIRE ARTIFACT</h2>
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b-4 border-black pb-6 gap-2"><span className="text-3xl font-comic uppercase text-[#e21c23]">ITEM:</span><span className="text-3xl font-black uppercase leading-none">{state.isCardStyled ? 'TRADING CARD SET' : 'COMIC BOOK PRINT'}</span></div>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b-4 border-black pb-6 gap-2"><span className="text-3xl font-comic uppercase text-[#e21c23]">HERO:</span><span className="text-3xl font-black uppercase leading-none truncate max-w-xs">{state.characterName}</span></div>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center pt-8 gap-4"><span className="text-4xl font-comic uppercase text-black">TOTAL COST:</span><span className="text-6xl font-comic text-[#e21c23] leading-none">${state.isCardStyled ? adminSettings.priceCardSet : adminSettings.priceComicPrint}</span></div>
                  </div>
                  <div className="space-y-6 pt-10"><button onClick={handleConfirmPurchase} disabled={isProcessingOrder} className="action-btn-yellow w-full py-10 text-5xl">{isProcessingOrder ? 'AUTHORIZING...' : 'PAY WITH PAYPAL'}</button><button onClick={goBack} className="text-2xl font-comic uppercase text-zinc-400 w-full hover:text-red-600 transition-colors">ABORT ACQUISITION</button></div>
                </div>
              </div>
            )}
          </div>
        )}

        {state.step === AppStep.COMMUNITY && (
          <div className="p-16 md:p-32 space-y-28 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-14"><div className="transform -rotate-1"><h2 className="text-[12rem] font-comic text-black italic uppercase tracking-tighter leading-none comic-text-3d">GLOBAL <br/><span className="text-[#fde910]">FEED</span></h2></div><div className="flex items-center space-x-6 bg-white p-4 border-8 border-black shadow-[15px_15px_0px_#660000]"><input type="text" placeholder="SEARCH HEROES..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent px-8 py-4 text-3xl font-comic uppercase outline-none w-full md:w-[450px] text-black" /></div></div>
             <div className="bg-[#e21c23] p-10 border-8 border-black shadow-[15px_15px_0px_#660000]"><h3 className="text-4xl font-comic uppercase text-white mb-8 italic">ACTIVE HEROES</h3><div className="flex space-x-12 overflow-x-auto pb-4 custom-scrollbar">{allProfiles.map(renderCreatorBadge)}</div></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-20">{publicFeed.length > 0 ? publicFeed.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).map(renderArtifactCard) : <div className="col-span-full py-80 text-center text-black/10 font-comic text-9xl italic">SILENCE...</div>}</div>
          </div>
        )}

        {state.step === AppStep.GALLERY && <div className="p-16 md:p-32 space-y-28 animate-fade-in"><div className="flex justify-between items-end border-b-8 border-black pb-20"><div className="transform rotate-1"><h2 className="text-[12rem] font-comic text-black italic uppercase tracking-tighter leading-none comic-text-3d">MY <br/><span className="text-[#fde910]">VAULT</span></h2></div><button onClick={() => { setIsFlipped(false); setState(prev => ({ ...prev, step: AppStep.STUDIO })); }} className="action-btn-red text-4xl">ADD NEW</button></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-20">{galleryItems.length > 0 ? galleryItems.map(renderArtifactCard) : <div className="col-span-full py-80 text-center text-black/10 font-comic text-9xl italic">VAULT EMPTY...</div>}</div></div>}
        {state.step === AppStep.CATEGORY_SELECT && (<div className="py-40 animate-fade-in m-auto w-full"><Carousel items={CATEGORIES} onItemSelect={(cat) => setState(prev => ({ ...prev, selectedCategory: cat, step: AppStep.SUBCATEGORY_SELECT }))} title="PICK A UNIVERSE" /></div>)}
        {state.step === AppStep.SUBCATEGORY_SELECT && (<div className="py-40 animate-fade-in m-auto w-full"><Carousel items={state.selectedCategory?.subcategories || []} onItemSelect={(sub) => setState(prev => ({ ...prev, selectedSubcategory: sub }))} title={`${state.selectedCategory?.name} LOCATIONS`} isSubView={true} onBack={goBack} onConfirm={startProcessing} selectedIndex={state.selectedCategory?.subcategories?.findIndex(s => s.id === state.selectedSubcategory?.id)} /></div>)}
        {state.step === AppStep.PROCESSING && (<div className="flex flex-col items-center justify-center space-y-20 p-24 m-auto"><div className="speech-bubble mb-10 transform -rotate-3 scale-150 animate-kaboom"><p className="text-4xl font-comic text-[#e21c23] uppercase">POW! BIFF! PROCESSING!</p></div><h2 className="text-[10rem] font-comic comic-text-3d animate-pulse -skew-x-12">SHIFTING DIMENSIONS...</h2></div>)}
        {(state.step === AppStep.LOGIN || state.step === AppStep.SIGNUP) && (
          <div className="max-w-xl w-full mx-auto p-16 bg-white border-8 border-black space-y-12 animate-fade-in m-auto shadow-[20px_20px_0px_#660000] text-black">
            <div className="text-center space-y-6"><h2 className="text-8xl font-comic uppercase italic tracking-tighter comic-text-3d">{state.step === AppStep.LOGIN ? 'IDENTIFY!' : 'ENLIST!'}</h2></div>
            <form onSubmit={handleAuth} className="space-y-10"><div className="space-y-6"><input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-white border-4 border-black px-8 py-5 text-xl font-black uppercase outline-none focus:bg-yellow-50" placeholder="HERO EMAIL" required /><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-white border-4 border-black px-8 py-5 text-xl font-black uppercase outline-none focus:bg-yellow-50" placeholder="SECRET KEY" required /></div>{state.error && (<div className="p-5 border-4 border-black bg-red-100 transform -rotate-1"><p className="text-[#e21c23] text-lg font-comic uppercase text-center leading-tight">{state.error}</p></div>)}<div className="flex flex-col space-y-4"><button type="submit" disabled={authLoading} className="action-btn-red w-full py-8 text-4xl">{authLoading ? 'CONNECTING...' : 'LAUNCH!'}</button><button type="button" onClick={handleGuestLogin} className="action-btn-yellow w-full py-6 text-3xl">PLAY AS GUEST!</button></div><div className="flex justify-between items-center pt-4"><button type="button" onClick={() => setState(prev => ({ ...prev, step: state.step === AppStep.LOGIN ? AppStep.SIGNUP : AppStep.LOGIN, error: null }))} className="text-xl font-comic uppercase text-zinc-400 hover:text-black transition-colors">{state.step === AppStep.LOGIN ? 'ENLIST NEW HERO' : 'USE OLD IDENTITY'}</button><button type="button" onClick={() => setShowAdmin(true)} className="text-xl font-comic uppercase text-zinc-400 hover:text-red-600">SETUP</button></div></form>
          </div>
        )}
      </main>

      {selectedArtifact && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex items-center justify-center p-10 md:p-32 overflow-y-auto animate-fade-in" onClick={() => { setIsFlipped(false); setSelectedArtifact(null); }}>
           <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-24 items-center" onClick={e => e.stopPropagation()}>
              <div className="lg:col-span-7 bg-white p-3 border-8 border-black shadow-[30px_30px_0px_rgba(102,0,0,0.5)]">
                <div ref={previewRef} className="relative aspect-[3/4] overflow-hidden bg-black">
                  {selectedArtifact.type === 'card' ? (
                     <>
                        <TradingCard frontImage={selectedArtifact.image} backImage={selectedArtifact.originalSourceImage || selectedArtifact.image} stats={selectedArtifact.stats || {strength:5,intelligence:5,agility:5,speed:5}} characterName={selectedArtifact.name} characterDescription={selectedArtifact.description || ''} category={selectedArtifact.category} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} imageScale={selectedArtifact.cardTransform?.scale} imageOffset={selectedArtifact.cardTransform?.offset} flipH={selectedArtifact.cardTransform?.flipH} flipV={selectedArtifact.cardTransform?.flipV} backImageScale={selectedArtifact.cardBackTransform?.scale} backImageOffset={selectedArtifact.cardBackTransform?.offset} backFlipH={selectedArtifact.cardBackTransform?.flipH} backFlipV={selectedArtifact.cardBackTransform?.flipV} />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-1 font-comic text-sm border-2 border-white animate-bounce pointer-events-none z-[100]">TAP TO FLIP</div>
                     </>
                  ) : (
                    <>
                        <img src={selectedArtifact.image} className="w-full h-full object-cover origin-center" style={{ transform: `translate(${selectedArtifact.comicTransform?.offset?.x || 0}%, ${selectedArtifact.comicTransform?.offset?.y || 0}%) scale(${(selectedArtifact.comicTransform?.scale || 1) * (selectedArtifact.comicTransform?.flipH ? -1 : 1)}, ${(selectedArtifact.comicTransform?.scale || 1) * (selectedArtifact.comicTransform?.flipV ? -1 : 1)})` }} />
                        {selectedArtifact.type === 'comic' && <ComicFrame category={selectedArtifact.category} subcategory="" customTitle={selectedArtifact.name} titleOffset={selectedArtifact.titleOffset} showPriceBadge={selectedArtifact.showPriceBadge} showBrandLogo={selectedArtifact.showBrandLogo} />}
                    </>
                  )}
                </div>
              </div>
              <div className="lg:col-span-5 space-y-16">
                 <div className="flex justify-between items-start"><div className="space-y-8"><h2 className="text-8xl md:text-10xl font-comic text-white italic uppercase tracking-tighter leading-none comic-text-3d">{selectedArtifact.name}</h2><div className="bg-white p-4 border-8 border-black inline-block -rotate-3"><span className="text-3xl font-comic text-black uppercase">By {selectedArtifact.userProfile?.display_name || 'Hero'}</span></div></div><button onClick={() => { setIsFlipped(false); setSelectedArtifact(null); }} className="p-8 bg-white border-8 border-black hover:bg-[#e21c23] hover:text-white transition-all"><i className="fa-solid fa-times text-5xl"></i></button></div>
                 <div className="bg-white p-12 border-8 border-black shadow-[15px_15px_0px_#660000] space-y-10 text-black">
                    <p className="text-2xl font-bold uppercase italic leading-tight">{selectedArtifact.description}</p>
                    <div className="flex flex-col space-y-4 pt-4">
                      {state.currentUser?.id === selectedArtifact.userId && (<button onClick={() => togglePublicStatus(selectedArtifact)} className={`w-full py-4 font-comic text-2xl uppercase border-4 border-black transition-all ${selectedArtifact.isPublic ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'}`}>{selectedArtifact.isPublic ? 'MAKE PRIVATE' : 'MAKE PUBLIC'}</button>)}
                      <button onClick={(e) => handleLike(e, selectedArtifact!.id)} className="action-btn-red w-full text-3xl">SYNERGY: {selectedArtifact.likeCount || 0}</button>
                      
                      {/* Detailed Download Controls in Modal */}
                      <div className="bg-zinc-100 p-6 border-4 border-black space-y-4">
                        <p className="text-xl font-comic uppercase tracking-widest text-[#e21c23]">GET DIGITAL FILE</p>
                        {selectedArtifact.type === 'card' ? (
                          <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleDownload('card-front', 'front')} disabled={isDownloading} className="action-btn-yellow !py-4 !text-xl flex-grow"><i className="fa-solid fa-download mr-2"></i>FRONT</button>
                            <button onClick={() => handleDownload('card-back', 'back')} disabled={isDownloading} className="action-btn-yellow !py-4 !text-xl flex-grow"><i className="fa-solid fa-download mr-2"></i>BACK</button>
                          </div>
                        ) : (
                          <button onClick={() => handleDownload(selectedArtifact!.type === 'comic' ? 'comic-cover' : 'raw-hero')} disabled={isDownloading} className="action-btn-yellow w-full text-2xl !py-4">
                            <i className="fa-solid fa-download mr-2"></i>SAVE AS {selectedArtifact.type === 'comic' ? 'COMIC' : 'RAW'} PNG
                          </button>
                        )}
                      </div>

                      {selectedArtifact.type !== 'raw' && (<button onClick={handlePhysicalOrderStart} className="action-btn-yellow w-full text-3xl !bg-[#fde910]">ORDER PHYSICAL ARTIFACT</button>)}
                      {state.currentUser && (state.currentUser.id === selectedArtifact.userId || isAdmin) && (<div className="flex gap-4"><button onClick={() => handleEditHero(selectedArtifact)} className="action-btn-yellow flex-grow text-2xl !bg-[#fde910]"><i className="fa-solid fa-pen-to-square mr-3"></i> EDIT HERO</button><button onClick={() => handleDeleteHero(selectedArtifact.id)} className="p-6 bg-red-600 border-4 border-black text-white hover:bg-black transition-all"><i className="fa-solid fa-trash text-2xl"></i></button></div>)}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showAdmin && (
        <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-10 animate-fade-in">
          <div className="max-w-4xl w-full bg-white border-8 border-black p-16 space-y-12 shadow-[25px_25px_0px_#660000] text-black">
            <div className="flex justify-between items-center"><h2 className="text-7xl font-comic uppercase italic tracking-tighter comic-text-3d">SETUP PANEL</h2><button onClick={() => setShowAdmin(false)} className="action-btn-red !py-4 !text-xl">CLOSE</button></div>
            <div className="space-y-8"><div className="p-8 bg-zinc-100 border-4 border-black space-y-6"><p className="text-xl font-comic uppercase tracking-widest text-[#e21c23]">SUPABASE CONNECTION</p><input type="text" placeholder="SUPABASE URL" value={adminSettings.supabaseUrl || ''} onChange={e => setAdminSettings({...adminSettings, supabaseUrl: e.target.value})} className="w-full bg-white border-4 border-black px-6 py-4 font-mono text-sm outline-none" /><input type="password" placeholder="ANON KEY" value={adminSettings.supabaseAnonKey || ''} onChange={e => setAdminSettings({...adminSettings, supabaseAnonKey: e.target.value})} className="w-full bg-white border-4 border-black px-6 py-4 font-mono text-sm outline-none" /></div><div className="p-8 bg-zinc-100 border-4 border-black space-y-6"><p className="text-xl font-comic uppercase tracking-widest text-[#fde910] comic-text-3d">AUTOMATION NODE</p><input type="text" placeholder="WEBHOOK URL" value={adminSettings.n8nWebhookUrl || ''} onChange={e => setAdminSettings({...adminSettings, n8nWebhookUrl: e.target.value})} className="w-full bg-white border-4 border-black px-6 py-4 font-mono text-sm outline-none" /></div></div>
            <button onClick={() => { localStorage.setItem('cos-admin-settings', JSON.stringify(adminSettings)); setShowAdmin(false); window.location.reload(); }} className="action-btn-yellow w-full py-8 text-4xl">SAVE & REBOOT CORE!</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
