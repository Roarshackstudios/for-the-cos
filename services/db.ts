
import { createClient } from '@supabase/supabase-js';
import { SavedGeneration, ApiLog, PhysicalOrder } from '../types';

// We pull these from the environment. If they are missing, we don't crash.
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Only create the client if we have the actual data. 
// This prevents the "supabaseUrl is required" error.
export const supabase = (supabaseUrl.length > 0 && supabaseAnonKey.length > 0) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const BUCKET_NAME = 'cosplay-artifacts';

const base64ToBlob = (base64: string): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
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
  
  const blob = base64ToBlob(base64);
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, blob, { contentType: 'image/png' });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrl;
};

export const saveGeneration = async (gen: SavedGeneration): Promise<void> => {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const imageUrl = await uploadToStorage(gen.image, 'generations');
  const sourceUrl = gen.originalSourceImage ? await uploadToStorage(gen.originalSourceImage, 'sources') : null;

  await supabase.from('generations').upsert({
    ...gen,
    user_id: userData.user.id,
    image: imageUrl,
    original_source_image: sourceUrl
  });
};

export const getAllGenerations = async (): Promise<SavedGeneration[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .order('timestamp', { ascending: false });
  return error ? [] : data as SavedGeneration[];
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
  await supabase.from('orders').insert({ ...order, user_id: userData.user.id, preview_image: previewUrl });
};

export const getAllOrders = async (): Promise<PhysicalOrder[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
  return error ? [] : data as PhysicalOrder[];
};

export const logApiCall = async (log: ApiLog): Promise<void> => {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('api_logs').insert({ ...log, user_id: userData.user?.id || null });
};

export const getApiLogs = async (): Promise<ApiLog[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('api_logs').select('*').order('timestamp', { ascending: false });
  return error ? [] : data as ApiLog[];
};

export const clearApiLogs = async (): Promise<void> => {
  if (!supabase) return;
  await supabase.from('api_logs').delete().neq('id', '0');
};
