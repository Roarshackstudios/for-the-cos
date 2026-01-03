import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SavedGeneration, PhysicalOrder, User, UserProfile } from '../types';

const isValid = (val: any): val is string => {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (
    trimmed.length > 0 && 
    trimmed !== 'undefined' && 
    trimmed !== 'null' &&
    trimmed !== '' &&
    !trimmed.startsWith('{{')
  );
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey: string | null = null;

export const getSupabase = (): SupabaseClient | null => {
  let targetUrl = '';
  let targetKey = '';

  try {
    const envUrl = process.env.SUPABASE_URL;
    const envKey = process.env.SUPABASE_ANON_KEY;

    if (isValid(envUrl) && isValid(envKey)) {
      targetUrl = envUrl.trim();
      targetKey = envKey.trim();
    }

    const settingsStr = localStorage.getItem('cos-admin-settings');
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        if (isValid(settings.supabaseUrl) && isValid(settings.supabaseAnonKey)) {
          targetUrl = settings.supabaseUrl.trim();
          targetKey = settings.supabaseAnonKey.trim();
        }
      } catch (e) {
        console.warn("Failed to parse local admin settings:", e);
      }
    }

    if (!targetUrl || !targetKey) return null;

    const configIdentifier = `${targetUrl}-${targetKey}`;
    if (cachedClient && cachedConfigKey === configIdentifier) {
      return cachedClient;
    }

    if (targetUrl.startsWith('http')) {
      cachedClient = createClient(targetUrl, targetKey);
      cachedConfigKey = configIdentifier;
      return cachedClient;
    }
  } catch (e) {
    console.error("Critical failure initializing Supabase:", e);
  }

  return null;
};

const BUCKET_NAME = 'cosplay-artifacts';

const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(',');
  const byteString = atob(parts[1]);
  const mimeString = parts[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

const uploadToStorage = async (base64: string, path: string): Promise<string> => {
  const client = getSupabase();
  if (!client) return base64;
  if (!base64 || !base64.startsWith('data:')) return base64; 
  
  try {
    const blob = base64ToBlob(base64);
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { contentType: 'image/png', upsert: true });

    if (error) {
      console.warn("Storage upload error (ignoring and using base64):", error.message);
      return base64;
    }

    const { data: { publicUrl } } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err: any) {
    console.error("Storage upload failed:", err);
    return base64; 
  }
};

const syncProfile = async (user: User) => {
  const client = getSupabase();
  if (!client) return;
  await client.from('profiles').upsert({ id: user.id, email: user.email.toLowerCase() }, { onConflict: 'id' });
};

export const getCurrentUser = async (): Promise<User | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const mapped = { id: user.id, email: user.email! };
  await syncProfile(mapped);
  return mapped;
};

export const signIn = async (email: string, password: string): Promise<User> => {
  const client = getSupabase();
  if (!client) throw new Error("Cloud core connection is not active.");
  const { data, error } = await client.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (error) throw error;
  const mapped = { id: data.user.id, email: data.user.email! };
  await syncProfile(mapped);
  return mapped;
};

export const signUp = async (email: string, password: string): Promise<User> => {
  const client = getSupabase();
  if (!client) throw new Error("Cloud core connection is not active.");
  const { data, error } = await client.auth.signUp({ email: email.toLowerCase(), password });
  if (error) throw error;
  if (!data.user) throw new Error("Sign up failed.");
  const mapped = { id: data.user.id, email: data.user.email! };
  await syncProfile(mapped);
  return mapped;
};

export const signOut = async (): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
};

export const getProfileById = async (userId: string): Promise<UserProfile | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
};

export const getAllProfiles = async (): Promise<UserProfile[]> => {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('profiles').select('*').limit(50);
  if (error) return [];
  return data;
};

export const toggleLike = async (userId: string, generationId: string): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  
  const { data: existing, error } = await client
    .from('likes')
    .select('user_id')
    .eq('user_id', userId)
    .eq('generation_id', generationId)
    .maybeSingle();
    
  if (error) throw error;

  if (existing) {
    await client.from('likes').delete().match({ user_id: userId, generation_id: generationId });
    return false;
  } else {
    await client.from('likes').insert({ user_id: userId, generation_id: generationId });
    return true;
  }
};

export const updateGenerationVisibility = async (id: string, isPublic: boolean): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  await client.from('generations').update({ is_public: isPublic }).eq('id', id);
};

export const saveGeneration = async (gen: SavedGeneration): Promise<void> => {
  const client = getSupabase();
  if (!client) throw new Error("Cloud core connection is not active.");
  
  const imageUrl = await uploadToStorage(gen.image, 'generations');
  const sourceUrl = gen.originalSourceImage ? await uploadToStorage(gen.originalSourceImage, 'sources') : null;

  const packedStats = {
    ...gen.stats,
    _transforms: { 
      comic: gen.comicTransform,
      card: gen.cardTransform,
      cardBack: gen.cardBackTransform,
      titleOffset: gen.titleOffset,
      showPriceBadge: gen.showPriceBadge,
      showBrandLogo: gen.showBrandLogo
    }
  };

  const payload: any = {
    id: gen.id,
    user_id: gen.userId,
    timestamp: gen.timestamp,
    image: imageUrl, 
    name: gen.name,
    category: gen.category,
    type: gen.type,
    stats: packedStats,
    description: gen.description,
    card_status_text: gen.cardStatusText,
    original_source_image: sourceUrl,
    is_public: gen.isPublic || false
  };

  const { error } = await client.from('generations').upsert(payload);
  if (error) throw error;
};

const mapGeneration = (item: any, currentUserId?: string): SavedGeneration => {
  const transforms = item.stats?._transforms;
  const likes = Array.isArray(item.likes) ? item.likes : [];
  const likeCount = likes.length;
  const userHasLiked = currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false;
  
  const defaultTransform = { scale: 1, offset: { x: 0, y: 0 }, flipH: false, flipV: false };

  return {
    id: item.id, 
    userId: item.user_id, 
    timestamp: item.timestamp, 
    image: item.image,
    name: item.name, 
    category: item.category, 
    type: item.type, 
    stats: item.stats,
    description: item.description, 
    cardStatusText: item.card_status_text,
    originalSourceImage: item.original_source_image, 
    comicTransform: transforms?.comic || defaultTransform,
    cardTransform: transforms?.card || defaultTransform,
    cardBackTransform: transforms?.cardBack || defaultTransform,
    titleOffset: transforms?.titleOffset || { x: 0, y: 0 },
    showPriceBadge: transforms?.showPriceBadge !== undefined ? transforms.showPriceBadge : true,
    showBrandLogo: transforms?.showBrandLogo !== undefined ? transforms.showBrandLogo : true,
    isPublic: item.is_public,
    likeCount,
    userHasLiked,
    commentCount: 0, 
    userProfile: item.profiles
  };
};

export const getPublicGenerations = async (currentUserId?: string): Promise<SavedGeneration[]> => {
  const client = getSupabase();
  if (!client) return [];
  
  const { data, error } = await client
    .from('generations')
    .select('*, profiles(*), likes(user_id)')
    .eq('is_public', true)
    .order('timestamp', { ascending: false });

  if (error) return [];
  return data.map(item => mapGeneration(item, currentUserId));
};

export const getAllGenerations = async (userId: string): Promise<SavedGeneration[]> => {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('generations')
    .select('*, profiles(*), likes(user_id)')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });
  if (error) return [];
  return data.map(item => mapGeneration(item, userId));
};

export const deleteGeneration = async (id: string): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  await client.from('generations').delete().eq('id', id);
};

export const saveOrder = async (order: PhysicalOrder): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  const previewUrl = await uploadToStorage(order.previewImage, 'orders');
  await client.from('orders').insert({ 
    id: order.id, user_id: order.userId, timestamp: order.timestamp,
    paypal_order_id: order.paypalOrderId, item_type: order.itemType,
    item_name: order.itemName, amount: order.amount, status: order.status,
    preview_image: previewUrl
  });
};