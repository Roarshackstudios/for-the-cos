
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SavedGeneration, ApiLog, PhysicalOrder, User, UserProfile, Comment } from '../types';

/**
 * Validates if a configuration string is a real value and not a placeholder or 'undefined'.
 */
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

/**
 * Retrieves the Supabase client, prioritizing manual settings over environment variables.
 */
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
  // Use a minimal upsert to avoid triggering "column does not exist" on display_name or avatar_url
  // if the schema is not yet fully initialized.
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

export const updateProfile = async (profile: Partial<UserProfile>): Promise<void> => {
  const client = getSupabase();
  if (!client || !profile.id) throw new Error("Access denied.");
  
  let avatarUrl = profile.avatar_url;
  if (avatarUrl && avatarUrl.startsWith('data:')) {
    avatarUrl = await uploadToStorage(avatarUrl, 'avatars');
  }

  const payload: any = {
    id: profile.id,
    display_name: profile.display_name,
    avatar_url: avatarUrl
  };

  const { error } = await client.from('profiles').upsert(payload, { onConflict: 'id' });

  if (error) {
    if (error.message.includes('column') && error.message.includes('schema cache')) {
      throw new Error("Profile synchronization failed due to a missing column in the database cache. Please go to the Admin panel (Gear icon) and execute the 'NEXUS SCHEMA FIX' SQL script, then reboot.");
    }
    throw error;
  }
};

export const toggleLike = async (userId: string, generationId: string): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  const { data: existing } = await client.from('likes').select('*').match({ user_id: userId, generation_id: generationId }).single();
  if (existing) {
    await client.from('likes').delete().match({ user_id: userId, generation_id: generationId });
    return false;
  } else {
    await client.from('likes').insert({ user_id: userId, generation_id: generationId });
    return true;
  }
};

export const addComment = async (userId: string, generationId: string, content: string): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  await client.from('comments').insert({ user_id: userId, generation_id: generationId, content });
};

export const getComments = async (generationId: string): Promise<Comment[]> => {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('comments').select(`*, profiles(*)`).eq('generation_id', generationId).order('created_at', { ascending: true });
  if (error) return [];
  return data.map((c: any) => ({
    id: c.id, userId: c.user_id, generationId: c.generation_id, content: c.content,
    timestamp: new Date(c.created_at).getTime(), userProfile: c.profiles
  }));
};

export const saveGeneration = async (gen: SavedGeneration): Promise<void> => {
  const client = getSupabase();
  if (!client) throw new Error("Cloud core connection is not active.");
  
  const imageUrl = await uploadToStorage(gen.image, 'generations');
  const sourceUrl = gen.originalSourceImage ? await uploadToStorage(gen.originalSourceImage, 'sources') : null;

  const packedStats = {
    ...gen.stats,
    _transform: { scale: gen.resultScale, offset: gen.resultOffset }
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

  try {
    const { error } = await client.from('generations').upsert(payload);
    if (error) {
      if (error.message.includes('is_public') || error.code === '42703') {
        if (gen.isPublic) {
          throw new Error("Broadcasting to Nexus requires the 'is_public' column. Go to the Admin panel (gear icon) and run the SQL fix.");
        }
        delete payload.is_public;
        const { error: retryError } = await client.from('generations').upsert(payload);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  } catch (err: any) {
    throw new Error(err.message);
  }
};

/**
 * Maps raw database items to SavedGeneration objects.
 */
const mapGeneration = (item: any, profile?: any): SavedGeneration => {
  const transform = item.stats?._transform;
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
    resultScale: transform?.scale || 1,
    resultOffset: transform?.offset || { x: 0, y: 0 }, 
    isPublic: item.is_public,
    likeCount: item.likes?.[0]?.count || 0, 
    commentCount: 0, 
    userProfile: profile || item.profiles
  };
};

export const getPublicGenerations = async (): Promise<SavedGeneration[]> => {
  const client = getSupabase();
  if (!client) return [];
  
  try {
    const { data: rawGens, error: genError } = await client
      .from('generations')
      .select('*')
      .eq('is_public', true)
      .order('timestamp', { ascending: false });

    if (genError || !rawGens) {
      console.warn("Nexus generation fetch failed:", genError?.message);
      return [];
    }

    const userIds = [...new Set(rawGens.map(g => g.user_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data: profiles, error: profError } = await client
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (!profError && profiles) {
        profilesMap = profiles.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      } else {
        console.warn("Nexus profile sync failed:", profError?.message);
      }
    }

    return rawGens.map(item => mapGeneration(item, profilesMap[item.user_id]));

  } catch (err) {
    console.error("Critical Nexus communication failure:", err);
    return [];
  }
};

export const getAllGenerations = async (userId: string): Promise<SavedGeneration[]> => {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('generations').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
  if (error) return [];
  return data.map(item => mapGeneration(item));
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

export const logApiCall = async (log: ApiLog): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  await client.from('api_logs').insert({ 
    id: log.id, timestamp: log.timestamp, user_session: log.userSession,
    model: log.model, category: log.category, subcategory: log.subcategory,
    cost: log.cost, status: log.status
  });
};
