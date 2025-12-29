
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
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  UPLOAD = 'UPLOAD',
  CATEGORY_SELECT = 'CATEGORY_SELECT',
  SUBCATEGORY_SELECT = 'SUBCATEGORY_SELECT',
  PROCESSING = 'PROCESSING',
  RESULT = 'RESULT',
  GALLERY = 'GALLERY'
}

export interface User {
  id: string;
  email: string;
  password?: string; // Stored locally for demo purposes
}

export interface CardStats {
  strength: number;
  intelligence: number;
  energy: number;
  mental: number;
  fighting: number;
  speed: number;
}

export interface AdminSettings {
  defaultTitle: string;
  defaultDescription: string;
  paypalClientIdSandbox: string;
  paypalClientIdProduction: string;
  isPaypalProduction: boolean;
  priceComicPrint: number;
  priceCardSet: number;
}

export interface ApiLog {
  id: string;
  timestamp: number;
  userSession: string;
  model: string;
  category: string;
  subcategory: string;
  cost: number;
  status: 'success' | 'error';
}

export interface PhysicalOrder {
  id: string;
  timestamp: number;
  paypalOrderId: string;
  itemType: 'comic' | 'card';
  itemName: string;
  amount: number;
  status: 'paid' | 'shipped';
  previewImage: string;
}

export interface SavedGeneration {
  id: string;
  timestamp: number;
  image: string;
  name: string;
  category: string;
  type: 'raw' | 'comic' | 'card';
  stats?: CardStats;
  description?: string;
  cardStatusText?: string;
  originalSourceImage?: string; 
}

export interface AppState {
  step: AppStep;
  currentUser: User | null;
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
