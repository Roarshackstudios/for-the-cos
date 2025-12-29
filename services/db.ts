import { createClient } from '@supabase/supabase-js';
import { SavedGeneration, ApiLog, PhysicalOrder } from '../types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const isValid = (val: any): val is string => 
  typeof val === 'string' && val.length > 0 && val !== 'undefined';

export const supabase = (isValid(supabaseUrl) && isValid(supabaseAnonKey)) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

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
  if (!supabase) throw new Error("Supabase configuration missing.");
  if (!base64 || base64.startsWith('http')) return base64; 
  
  try {
    const blob = base64ToBlob(base64);
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, blob, { 
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error("Storage upload error:", error);
      throw new Error(`Storage upload failed: ${error.message}. Ensure the bucket '${BUCKET_NAME}' exists and is set to PUBLIC.`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (err: any) {
    console.error("Critical upload failure:", err);
    throw err;
  }
};

export const saveGeneration = async (gen: SavedGeneration): Promise<void> => {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Authentication required.");

  const imageUrl = await uploadToStorage(gen.image, 'generations');
  const sourceUrl = gen.originalSourceImage ? await uploadToStorage(gen.originalSourceImage, 'sources') : null;

  const { error } = await supabase.from('generations').upsert({
    id: gen.id,
    timestamp: gen.timestamp,
    image: imageUrl,
    name: gen.name,
    category: gen.category,
    type: gen.type,
    stats: gen.stats,
    description: gen.description,
    card_status_text: gen.cardStatusText,
    original_source_image: sourceUrl,
    user_id: userData.user.id
  });

  if (error) {
    console.error("Database upsert error:", error);
    throw new Error(`Database error: ${error.message}`);
  }
};

export const getAllGenerations = async (): Promise<SavedGeneration[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .order('timestamp', { ascending: false });
    
  if (error) return [];
  
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
};

export const deleteGeneration = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('generations').delete().eq('id', id);
};

export const saveOrder = async (order: PhysicalOrder): Promise<void> => {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  
  const previewUrl = await uploadToStorage(order.previewImage, 'orders');
  
  await supabase.from('orders').insert({ 
    id: order.id,
    timestamp: order.timestamp,
    paypal_order_id: order.paypalOrderId,
    item_type: order.itemType,
    item_name: order.itemName,
    amount: order.amount,
    status: order.status,
    preview_image: previewUrl,
    user_id: userData.user.id 
  });
};

export const getAllOrders = async (): Promise<PhysicalOrder[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
  if (error) return [];
  
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
};

export const logApiCall = async (log: ApiLog): Promise<void> => {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('api_logs').insert({ 
    id: log.id,
    timestamp: log.timestamp,
    user_session: log.userSession,
    model: log.model,
    category: log.category,
    subcategory: log.subcategory,
    cost: log.cost,
    status: log.status,
    user_id: userData.user?.id || null 
  });
};

export const getApiLogs = async (): Promise<ApiLog[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('api_logs').select('*').order('timestamp', { ascending: false });
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
};

export const clearApiLogs = async (): Promise<void> => {
  if (!supabase) return;
  await supabase.from('api_logs').delete().neq('id', '0');
};