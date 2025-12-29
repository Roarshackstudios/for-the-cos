
import { Category } from './types';

export const CATEGORIES: Category[] = [
  {
    id: 'custom',
    name: 'Custom',
    description: 'Design your own reality',
    image: 'https://picsum.photos/seed/custom/800/1200',
    isCustom: true
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Breathtaking natural worlds',
    image: 'https://picsum.photos/seed/nature/800/1200',
    subcategories: [
      { id: 'nature-auto', name: 'Auto Detect', description: 'Smart context placement', image: 'https://picsum.photos/seed/n-auto/400/600' },
      { id: 'nature-forest', name: 'Forest', description: 'Ancient woodland', image: 'https://picsum.photos/seed/forest/400/600' },
      { id: 'nature-desert', name: 'Desert', description: 'Sun-drenched dunes', image: 'https://picsum.photos/seed/desert/400/600' },
      { id: 'nature-arctic', name: 'Arctic', description: 'Frozen wasteland', image: 'https://picsum.photos/seed/arctic/400/600' },
      { id: 'nature-volcano', name: 'Volcano', description: 'Molten earth', image: 'https://picsum.photos/seed/volc/400/600' }
    ]
  },
  {
    id: 'comic',
    name: 'Comic',
    description: 'Step into the pages',
    image: 'https://picsum.photos/seed/comic/800/1200',
    subcategories: [
      { id: 'comic-auto', name: 'Auto Detect', description: 'Classic comic world', image: 'https://picsum.photos/seed/c-auto/400/600' }
    ]
  },
  {
    id: 'action',
    name: 'Action',
    description: 'Pure adrenaline',
    image: 'https://picsum.photos/seed/action/800/1200',
    subcategories: [
      { id: 'action-auto', name: 'Auto Detect', description: 'Dynamic battlefield', image: 'https://picsum.photos/seed/a-auto/400/600' },
      { id: 'action-explosion', name: 'Explosion', description: 'Cinematic chaos', image: 'https://picsum.photos/seed/explos/400/600' },
      { id: 'action-volcano', name: 'Volcano', description: 'Primal erupting power', image: 'https://picsum.photos/seed/avolc/400/600' },
      { id: 'action-armageddon', name: 'Armageddon', description: 'End of days', image: 'https://picsum.photos/seed/arma/400/600' }
    ]
  },
  {
    id: 'scifi',
    name: 'Science Fiction',
    description: 'The future is now',
    image: 'https://picsum.photos/seed/scifi/800/1200',
    subcategories: [
      { id: 'scifi-auto', name: 'Auto Detect', description: 'Techno-logical future', image: 'https://picsum.photos/seed/s-auto/400/600' },
      { id: 'scifi-city', name: 'Futuristic City', description: 'Neon skyline', image: 'https://picsum.photos/seed/neoncity/400/600' },
      { id: 'scifi-ship', name: 'Starship Interiors', description: 'Deep space vessel', image: 'https://picsum.photos/seed/starship/400/600' },
      { id: 'scifi-dystopian', name: 'Dystopian', description: 'Cyberpunk decay', image: 'https://picsum.photos/seed/dysto/400/600' }
    ]
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Magic and mystery',
    image: 'https://picsum.photos/seed/fantasy/800/1200',
    subcategories: [
      { id: 'fantasy-auto', name: 'Auto Detect', description: 'Mythical realm', image: 'https://picsum.photos/seed/f-auto/400/600' },
      { id: 'fantasy-forest', name: 'Ethereal Forest', description: 'Glowing flora', image: 'https://picsum.photos/seed/ethforest/400/600' },
      { id: 'fantasy-falls', name: 'Waterfalls', description: 'Majestic cascades', image: 'https://picsum.photos/seed/falls/400/600' },
      { id: 'fantasy-mtn', name: 'Enchanted Mountains', description: 'Sky-piercing peaks', image: 'https://picsum.photos/seed/enchmtn/400/600' },
      { id: 'fantasy-elves', name: 'Elven Enclaves', description: 'Living architecture', image: 'https://picsum.photos/seed/elves/400/600' },
      { id: 'fantasy-human', name: 'Human Kingdoms', description: 'High stone spires', image: 'https://picsum.photos/seed/h-kingdom/400/600' },
      { id: 'fantasy-dwarf', name: 'Dwarven Halls', description: 'Mountain deeps', image: 'https://picsum.photos/seed/dwarfh/400/600' },
      { id: 'fantasy-castles', name: 'Haunted Castles', description: 'Shadowy ruins', image: 'https://picsum.photos/seed/hcast/400/600' },
      { id: 'fantasy-swamp', name: 'Shadowy Swamps', description: 'Dark waters', image: 'https://picsum.photos/seed/swamp/400/600' },
      { id: 'fantasy-underworld', name: 'Underworld Realm', description: 'Chthonic glory', image: 'https://picsum.photos/seed/under/400/600' },
      { id: 'fantasy-arcane', name: 'Arcane Spaces', description: 'Mystic laboratories', image: 'https://picsum.photos/seed/arcane/400/600' }
    ]
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Be the hero',
    image: 'https://picsum.photos/seed/anime/800/1200',
    subcategories: [
      { id: 'anime-auto', name: 'Auto Detect', description: 'Cel-shaded destiny', image: 'https://picsum.photos/seed/an-auto/400/600' }
    ]
  }
];
