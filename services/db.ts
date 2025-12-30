import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SavedGeneration, ApiLog, PhysicalOrder } from '../types';

const isValid = (val: any): val is string => 
  typeof val === 'string' && 
  val.length > 0 && 
  val !== 'undefined' && 
  val !== 'null' &&
  !val.startsWith('{{');

// Singleton state
let cachedClient: SupabaseClient | null = null;
let cachedConfigKey: string | null = null;

// Dynamic getter to prevent top-level boot crashes and ensure singleton usage
const getSupabase = (): SupabaseClient | null => {
  let targetUrl = '';
  let targetKey = '';

  try {
    // 1. Check Environment Variables
    const envUrl = process.env.SUPABASE_URL;
    const envKey = process.env.SUPABASE_ANON_KEY;

    if (isValid(envUrl) && isValid(envKey)) {
      targetUrl = envUrl;
      targetKey = envKey;
    }

    // 2. Check LocalSettings (pasted in Admin Panel) - Overrides env if valid
    const settingsStr = localStorage.getItem('cos-admin-settings');
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        if (isValid(settings.supabaseUrl) && isValid(settings.supabaseAnonKey)) {
          const url = settings.supabaseUrl.trim();
          if (url.startsWith('http')) {
            targetUrl = url;
            targetKey = settings.supabaseAnonKey.trim();
          }
        }
      } catch (e) {}
    }

    if (!targetUrl || !targetKey) return null;

    // Check if we already have a client for this specific configuration
    const configIdentifier = `${targetUrl}-${targetKey}`;
    if (cachedClient && cachedConfigKey === configIdentifier) {
      return cachedClient;
    }

    // Create new instance and cache it
    const urlCheck = new URL(targetUrl);
    if (urlCheck.protocol === 'http:' || urlCheck.protocol === 'https:') {
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
const LOCAL_STORAGE_KEY = 'cos-local-generations';
const LOCAL_ORDERS_KEY = 'cos-local-orders';

const getLocalGenerations = (): SavedGeneration[] => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveLocalGeneration = (gen: SavedGeneration) => {
  const gens = getLocalGenerations();
  const index = gens.findIndex(g => g.id === gen.id);
  if (index >= 0) gens[index] = gen;
  else gens.push(gen);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gens));
};

const getLocalOrders = (): PhysicalOrder[] => {
  const data = localStorage.getItem(LOCAL_ORDERS_KEY);
  return data ? JSON.parse(data) : [];
};

const saveLocalOrder = (order: PhysicalOrder) => {
  const orders = getLocalOrders();
  orders.push(order);
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
};

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
  if (!base64 || base64.startsWith('http')) return base64; 
  
  try {
    const blob = base64ToBlob(base64);
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    const { data, error } = await client.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { contentType: 'image/png', upsert: true });

    if (error) return base64;

    const { data: { publicUrl } } = client.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err) {
    return base64;
  }
};

export const saveGeneration = async (gen: SavedGeneration): Promise<void> => {
  const client = getSupabase();
  if (!client) {
    saveLocalGeneration(gen);
    return;
  }
  
  try {
    const imageUrl = await uploadToStorage(gen.image, 'generations');
    const sourceUrl = gen.originalSourceImage ? await uploadToStorage(gen.originalSourceImage, 'sources') : null;

    const { error } = await client.from('generations').upsert({
      id: gen.id,
      timestamp: gen.timestamp,
      image: imageUrl,
      name: gen.name,
      category: gen.category,
      type: gen.type,
      stats: gen.stats,
      description: gen.description,
      card_status_text: gen.cardStatusText,
      original_source_image: sourceUrl
    });

    if (error) throw error;
  } catch (err: any) {
    saveLocalGeneration(gen);
    throw err;
  }
};

export const getAllGenerations = async (): Promise<SavedGeneration[]> => {
  const client = getSupabase();
  if (!client) return getLocalGenerations();
  
  try {
    const { data, error } = await client
      .from('generations')
      .select('*')
      .order('timestamp', { ascending: false });
      
    if (error) return getLocalGenerations();
    
    return data.map((item: any) => ({
      id: item.id,
      timestamp: item.timestamp,
      image: item.image,
      name: item.name,
      category: item.category,
      type: item.type,
      stats: item.stats,
      description: item.description,
      cardStatusText: item.card_status_text,
      originalSourceImage: item.original_source_image
    }));
  } catch (e) {
    return getLocalGenerations();
  }
};

export const deleteGeneration = async (id: string): Promise<void> => {
  const client = getSupabase();
  if (!client) {
    const gens = getLocalGenerations().filter(g => g.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gens));
    return;
  }
  try {
    await client.from('generations').delete().eq('id', id);
  } catch (e) {}
};

export const saveOrder = async (order: PhysicalOrder): Promise<void> => {
  const client = getSupabase();
  if (!client) {
    saveLocalOrder(order);
    return;
  }
  
  try {
    const previewUrl = await uploadToStorage(order.previewImage, 'orders');
    await client.from('orders').insert({ 
      id: order.id,
      timestamp: order.timestamp,
      paypal_order_id: order.paypalOrderId,
      item_type: order.itemType,
      item_name: order.itemName,
      amount: order.amount,
      status: order.status,
      preview_image: previewUrl
    });
  } catch (e) {
    saveLocalOrder(order);
  }
};

export const getAllOrders = async (): Promise<PhysicalOrder[]> => {
  const client = getSupabase();
  if (!client) return getLocalOrders();
  try {
    const { data, error } = await client.from('orders').select('*').order('timestamp', { ascending: false });
    if (error) return getLocalOrders();
    
    return data.map((item: any) => ({
      id: item.id,
      timestamp: item.timestamp,
      paypalOrderId: item.paypal_order_id,
      itemType: item.item_type,
      itemName: item.item_name,
      amount: item.amount,
      status: item.status,
      previewImage: item.preview_image
    }));
  } catch (e) {
    return getLocalOrders();
  }
};

export const logApiCall = async (log: ApiLog): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  try {
    await client.from('api_logs').insert({ 
      id: log.id,
      timestamp: log.timestamp,
      user_session: log.userSession,
      model: log.model,
      category: log.category,
      subcategory: log.subcategory,
      cost: log.cost,
      status: log.status
    });
  } catch (e) {}
};

export const getApiLogs = async (): Promise<ApiLog[]> => {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client.from('api_logs').select('*').order('timestamp', { ascending: false });
    if (error) return [];
    
    return data.map((item: any) => ({
      id: item.id,
      timestamp: item.timestamp,
      userSession: item.user_session,
      model: item.model,
      category: item.category,
      subcategory: item.subcategory,
      cost: item.cost,
      status: item.status
    }));
  } catch (e) {
    return [];
  }
};