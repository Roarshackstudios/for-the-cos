import React from 'react';
import { CardStats } from '../types';

interface TradingCardProps {
  frontImage: string;
  backImage: string;
  stats: CardStats;
  characterName: string;
  characterDescription: string;
  category: string;
  isFlipped: boolean;
  onFlip: () => void;
  statusText?: string; 
  exportSide?: 'front' | 'back';
  imageScale?: number;
  imageOffset?: { x: number; y: number };
  flipH?: boolean;
  flipV?: boolean;
  backImageScale?: number;
  backImageOffset?: { x: number; y: number };
  backFlipH?: boolean;
  backFlipV?: boolean;
}

const TradingCard: React.FC<TradingCardProps> = ({ 
  frontImage, 
  backImage, 
  stats, 
  characterName, 
  characterDescription,
  category,
  isFlipped,
  onFlip,
  statusText = "HEROIC",
  exportSide,
  imageScale = 1,
  imageOffset = { x: 0, y: 0 },
  flipH = false,
  flipV = false,
  backImageScale = 1,
  backImageOffset = { x: 0, y: 0 },
  backFlipH = false,
  backFlipV = false
}) => {
  const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex items-center space-x-4 w-full">
      <div className="w-24 md:w-32 flex items-center shrink-0">
        <span className="text-[10px] md:text-[12px] font-black italic uppercase tracking-wider text-zinc-100/90 whitespace-nowrap">
          {label}
        </span>
      </div>
      <div className="flex-grow h-1.5 md:h-2.5 bg-zinc-800/80 rounded-full relative overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
          style={{ 
            width: `${(value / 7) * 100}%`,
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}A0`
          }}
        />
      </div>
      <div className="w-4 md:w-6 text-right shrink-0">
        <span className="text-[10px] md:text-[12px] font-bold text-zinc-400">{value}</span>
      </div>
    </div>
  );

  const FrontSideContent = (
    <div 
      className={`absolute inset-0 overflow-hidden shadow-2xl border-[6px] md:border-[12px] border-black bg-white backface-hidden transition-opacity duration-300 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}
      style={{ 
        transform: 'rotateY(0deg)',
        zIndex: isFlipped ? 0 : 20 
      }}
    >
      <div className="w-full h-full overflow-hidden relative bg-zinc-900">
        <img 
          src={frontImage} 
          crossOrigin="anonymous" 
          className="w-full h-full object-cover origin-center" 
          style={{ 
            transform: `translate(${imageOffset.x}%, ${imageOffset.y}%) scale(${imageScale * (flipH ? -1 : 1)}, ${imageScale * (flipV ? -1 : 1)})` 
          }}
          alt="Card Front" 
        />
      </div>
      
      <div className="absolute top-0 left-0 right-0 p-4 md:p-10 bg-gradient-to-b from-black via-black/40 to-transparent">
         <h3 className="text-2xl md:text-5xl font-comic font-black text-[#fde910] italic tracking-tighter uppercase drop-shadow-[2px_2px_0px_#660000] md:drop-shadow-[4px_4px_0px_#660000] leading-[0.85] text-center w-full transform -rotate-2">
           {characterName}
         </h3>
      </div>

      <div className="absolute bottom-4 md:bottom-10 left-0 bg-[#e21c23] text-white font-comic text-lg md:text-2xl px-6 md:px-10 py-1 md:py-3 uppercase italic border-y-4 md:border-y-8 border-r-4 md:border-r-8 border-black shadow-2xl transform rotate-2">
         {statusText}
      </div>
    </div>
  );

  const BackSideContent = (
    <div 
      className={`absolute inset-0 overflow-hidden shadow-2xl border-[1px] border-zinc-700/50 bg-[#0d0d0d] flex flex-col backface-hidden transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}
      style={{ 
        transform: 'rotateY(180deg)',
        zIndex: isFlipped ? 20 : 0
      }}
    >
      {/* High-Tech Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[size:16px_16px]"></div>
      
      {/* Header Section */}
      <div className="px-6 md:px-10 pt-8 md:pt-12 flex justify-between items-start z-10">
        <div className="space-y-1">
          <h3 className="text-4xl md:text-6xl font-comic italic uppercase tracking-tighter text-white leading-none">
            {characterName.split(' ')[0]} {characterName.split(' ').length > 1 ? '...' : ''}
          </h3>
          <p className="text-[10px] md:text-[12px] font-black text-[#3b82f6] uppercase tracking-[0.2em] opacity-80">
            Classification: {category}
          </p>
        </div>
        <div className="relative w-12 h-12 md:w-16 md:h-16 bg-zinc-800/30 border border-zinc-700/50 rounded-xl flex items-center justify-center overflow-hidden">
           <span className="text-zinc-600 font-black text-[12px] md:text-[16px] opacity-40">01</span>
           <div className="absolute inset-0 border-2 border-white/5 opacity-10"></div>
           <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-white/20"></div>
           <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-white/20"></div>
           <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-white/20"></div>
           <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-white/20"></div>
        </div>
      </div>

      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent my-6"></div>

      {/* Profile Image Section */}
      <div className="px-6 md:px-10 flex flex-col z-10">
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-700/50 shadow-inner bg-black flex items-center justify-center">
          <img 
            src={backImage} 
            className="w-full h-full object-contain opacity-90 origin-center" 
            style={{ 
              transform: `translate(${backImageOffset.x}%, ${backImageOffset.y}%) scale(${backImageScale * (backFlipH ? -1 : 1)}, ${backImageScale * (backFlipV ? -1 : 1)})`
            }}
            alt="Original Character Shot" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
          <div className="absolute bottom-4 left-6 pointer-events-none">
             <span className="text-[10px] md:text-[12px] font-black italic text-[#3b82f6] uppercase tracking-widest drop-shadow-md">
                Cosplay Identity: Confirmed
             </span>
          </div>
        </div>
      </div>

      {/* Power Grid Section */}
      <div className="px-6 md:px-10 mt-8 md:mt-10 space-y-4 z-10 flex-grow">
        <div className="flex justify-between items-baseline mb-3 border-b border-zinc-800/50 pb-3">
           <h4 className="text-2xl md:text-3xl font-comic italic text-[#fde910] uppercase tracking-widest">Power Grid</h4>
           <div className="flex space-x-3 md:space-x-4 text-[8px] md:text-[10px] text-zinc-500 font-bold tracking-widest">
             {Array.from({length: 7}).map((_, i) => (
                <span key={i} className="w-3 md:w-4 text-center">{i + 1}</span>
             ))}
           </div>
        </div>
        
        <div className="space-y-4 md:space-y-6 bg-black/40 p-6 rounded-2xl border border-zinc-800/30 backdrop-blur-sm">
          <StatBar label="Strength" value={stats.strength} color="#ef4444" />
          <StatBar label="Intelligence" value={stats.intelligence} color="#3b82f6" />
          <StatBar label="Agility" value={stats.agility} color="#10b981" />
          <StatBar label="Speed" value={stats.speed} color="#ec4899" />
        </div>
      </div>

      {/* Description Section */}
      <div className="px-6 md:px-10 mt-6 md:mt-8 z-10">
        <div className="flex items-start space-x-4">
          <span className="text-2xl md:text-3xl font-black text-[#3b82f6] leading-none shrink-0">T</span>
          <p className="text-[10px] md:text-[12px] text-zinc-400 font-medium leading-relaxed uppercase tracking-tight line-clamp-2 md:line-clamp-3">
            {characterDescription || "The manifestation of this masterpiece represents a perfect fusion of craftsmanship and character essence. Every detail, from props to pose, has been analyzed and enhanced through our digital shifting matrix."}
          </p>
        </div>
      </div>

      {/* Footer Section */}
      <div className="mt-auto px-6 md:px-10 pb-10 md:pb-12 flex items-end justify-between z-10">
        <div className="flex items-center space-x-6">
           <div className="w-12 h-12 md:w-16 md:h-16 border border-zinc-700/50 p-2 rounded-xl bg-zinc-900/50 backdrop-blur-sm">
             <img src="https://i.ibb.co/nMbLsyGc/b3d20785-6f2c-4eac-b8a7-6bea68172314.png" className="w-full h-full object-contain opacity-60 grayscale" alt="Logo" />
           </div>
           <div className="flex flex-col">
             <p className="text-[6px] md:text-[7px] text-zinc-600 font-bold uppercase tracking-widest leading-none mb-1">
               ©2024 FOR THE COS ENTERTAINMENT
             </p>
             <p className="text-[6px] md:text-[7px] text-zinc-600 font-medium uppercase tracking-tight leading-none">
               PROCESSED BY GEMINI-AI NEURAL MAPPING
             </p>
             <p className="text-[6px] md:text-[7px] text-zinc-600 font-medium uppercase tracking-tight leading-none">
               AUTHENTICITY: VERIFIED [CLASS-S]
             </p>
           </div>
        </div>
        <div className="text-right">
           <span className="text-[12px] md:text-[14px] font-comic italic text-zinc-500 uppercase tracking-widest opacity-80">
             FOR THE COS
           </span>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="relative cursor-pointer perspective-1000 group w-full h-full mx-auto" 
      onClick={(e) => { e.stopPropagation(); onFlip(); }}
    >
      <div 
        className="relative w-full h-full transform-style-3d transition-transform duration-700 ease-in-out"
        style={{ 
          transform: `rotateY(${isFlipped ? 180 : 0}deg)`,
        }}
      >
        {FrontSideContent}
        {BackSideContent}
      </div>
    </div>
  );
};

export default TradingCard;