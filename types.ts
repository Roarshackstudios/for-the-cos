
export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  subcategories?: Subcategory[];
  isCustom?: boolean;
}

export interface Subcategory {
  id: string;
  name: string;
  description: string;
  image: string;
}

export enum AppStep {
  HOME = 'HOME',
  COMMUNITY = 'COMMUNITY',
  STUDIO = 'STUDIO',
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  UPLOAD = 'UPLOAD',
  CATEGORY_SELECT = 'CATEGORY_SELECT',
  SUBCATEGORY_SELECT = 'SUBCATEGORY_SELECT',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  GALLERY = 'GALLERY',
  PROFILE = 'PROFILE',
  VIEW_PROFILE = 'VIEW_PROFILE',
  CHECKOUT = 'CHECKOUT'
}

export interface User {
  id: string;
  email: string;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  discord?: string;
  website?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  socials?: SocialLinks;
  created_at?: string;
}

export interface Comment {
  id: string;
  userId: string;
  generationId: string;
  content: string;
  timestamp: number;
  userProfile?: UserProfile;
}

export interface Like {
  userId: string;
  generationId: string;
}

export interface CardStats {
  strength: number;
  intelligence: number;
  agility: number;
  speed: number;
}

export interface AdminSettings {
  defaultTitle: string;
  defaultDescription: string;
  paypalLinkComic: string;
  paypalLinkCard: string;
  priceComicPrint: number;
  priceCardSet: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  n8nWebhookUrl?: string;
}

export interface ApiLog {
  id: string;
  timestamp: number;
  userSession: string;
  model: string;
  category: string;
  subcategory: string;
  cost: number;
  status: string;
}

export interface PhysicalOrder {
  id: string;
  userId: string;
  timestamp: number;
  paypalOrderId: string;
  itemType: string;
  itemName: string;
  amount: number;
  status: string;
  previewImage: string;
}

export interface SavedGeneration {
  id: string;
  userId: string;
  timestamp: number;
  image: string; 
  name: string;
  category: string;
  type: 'raw' | 'comic' | 'card';
  stats?: CardStats;
  description?: string;
  cardStatusText?: string;
  originalSourceImage?: string; 
  resultScale?: number;
  resultOffset?: { x: number; y: number };
  isPublic?: boolean;
  likeCount?: number;
  userHasLiked?: boolean;
  commentCount?: number;
  userProfile?: UserProfile;
}

export interface AppState {
  step: AppStep;
  currentUser: User | null;
  targetProfile: UserProfile | null;
  sourceImage: string | null;
  selectedCategory: Category | null;
  selectedSubcategory: Subcategory | null;
  customPrompt: string;
  resultImage: string | null;
  isComicStyled: boolean;
  isCardStyled: boolean;
  stats: CardStats | null;
  characterName: string;
  characterDescription: string;
  cardStatusText: string;
  styleIntensity: number; 
  resultScale: number;
  resultOffset: { x: number; y: number };
  error: string | null;
  editingId: string | null;
}
