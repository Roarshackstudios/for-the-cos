
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
  statusText = "PREMIUM COLLECTOR",
  exportSide,
  imageScale = 1,
  imageOffset = { x: 0, y: 0 }
}) => {
  const logoUrl = "https://i.ibb.co/b43T8dM/1.png";
  
  const StatRow = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="flex items-center space-x-2 h-3.5">
      <span className="text-[7px] font-black w-20 uppercase italic text-white leading-none truncate tracking-tighter">{label}</span>
      <div className="flex-grow flex items-center relative h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-1000 shadow-[0_0_5px_rgba(255,255,255,0.3)]" 
          style={{ width: `${(value / 7) * 100}%`, backgroundColor: color }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.6)]" 
          style={{ left: `calc(${(value / 7) * 100}% - 3px)`, backgroundColor: color }}
        ></div>
      </div>
      <span className="text-[7px] font-bold text-white/50 w-2 text-right">{value}</span>
    </div>
  );

  const FrontSide = (
    <div className={`absolute inset-0 rounded-xl overflow-hidden shadow-2xl border-[5px] border-blue-600 bg-black backface-hidden z-20 ${exportSide === 'front' ? 'relative' : ''}`}>
      <div className="w-full h-full overflow-hidden relative">
        <img 
          src={frontImage} 
          crossOrigin="anonymous" 
          className="w-full h-full object-cover origin-center" 
          style={{ 
            transform: `scale(${imageScale}) translate(${imageOffset.x}%, ${imageOffset.y}%)` 
          }}
          alt="Card Front" 
        />
      </div>
      
      <div className="absolute top-0 left-0 right-0 p-5 bg-gradient-to-b from-black/90 via-black/30 to-transparent flex flex-col items-center pointer-events-none">
         <h3 className="text-xl md:text-2xl lg:text-3xl font-orbitron font-black text-white italic tracking-tighter uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-2 leading-[1.1] text-center w-full px-4 overflow-visible">
           {characterName}
         </h3>
         <div className="flex items-center space-x-2 mt-1">
            <div className="h-0.5 w-6 bg-blue-500"></div>
            <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] drop-shadow-sm">{category} UNIVERSE</span>
         </div>
      </div>

      <div className="absolute bottom-6 right-0 bg-blue-600 text-white font-black text-[10px] px-4 py-1.5 uppercase italic tracking-widest rounded-l-md shadow-xl border-y border-l border-blue-400/50 min-w-[120px] text-center pointer-events-none">
         {statusText.toUpperCase()}
      </div>

      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-transparent to-white/5 pointer-events-none opacity-40"></div>
    </div>
  );

  const BackSide = (
    <div className={`absolute inset-0 rounded-xl overflow-hidden shadow-2xl border-[5px] border-zinc-800 bg-[#121212] flex flex-col p-4 font-sans border-gradient-to-br from-blue-600 to-purple-600 backface-hidden rotate-y-180 z-10 ${exportSide === 'back' ? 'relative rotate-0' : ''}`}>
      <div className="flex justify-between items-center mb-4 border-b border-zinc-700 pb-2">
        <div className="flex flex-col">
          <h3 className="text-xl font-black italic text-white font-orbitron uppercase leading-none tracking-tighter truncate max-w-[180px]">{characterName}</h3>
          <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-1">Classification: Legendary</span>
        </div>
        <div className="w-10 h-10 bg-zinc-900 border-2 border-blue-500 rounded-full flex items-center justify-center shadow-lg">
           <span className="text-blue-500 font-black italic text-lg">01</span>
        </div>
      </div>

      <div className="flex flex-col space-y-4 flex-grow">
        <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-zinc-700 bg-black shadow-inner">
          <img src={backImage} crossOrigin="anonymous" className="w-full h-full object-cover object-top grayscale-[40%] hover:grayscale-0 transition-all duration-500" alt="Origin" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
          <div className="absolute bottom-2 left-3 text-[9px] font-black italic text-blue-400 uppercase">Cosplay Identity: Confirmed</div>
        </div>

        <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.2em] italic">Power Grid</span>
            <div className="flex space-x-1 opacity-40">
               {[1,2,3,4,5,6,7].map(n => <span key={n} className="text-[7px] font-bold text-white w-2 text-center">{n}</span>)}
            </div>
          </div>
          <StatRow label="Strength" value={stats.strength} color="#ef4444" />
          <StatRow label="Intelligence" value={stats.intelligence} color="#3b82f6" />
          <StatRow label="Energy" value={stats.energy} color="#f59e0b" />
          <StatRow label="Mental" value={stats.mental} color="#10b981" />
          <StatRow label="Fighting" value={stats.fighting} color="#8b5cf6" />
          <StatRow label="Speed" value={stats.speed} color="#ec4899" />
        </div>

        <div className="flex-grow p-1">
           <div className="text-[9px] leading-relaxed text-zinc-400 font-medium overflow-hidden line-clamp-4 relative">
             <span className="text-2xl font-black text-blue-500 float-left mr-2 mt-1 leading-[0.8] font-orbitron">T</span>
             {characterDescription}
           </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-end">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/5 rounded-lg p-1.5 border border-white/10">
            <img src={logoUrl} crossOrigin="anonymous" className="w-full h-full object-contain" alt="Logo" />
          </div>
          <div className="text-[6px] text-zinc-500 leading-tight font-mono uppercase tracking-tighter">
            ©2024 FOR THE COS ENTERTAINMENT<br/>
            PROCESSED BY GEMINI-AI NEURAL MAPPING<br/>
            AUTHENTICITY: VERIFIED [CLASS-S]
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black italic text-white/20 font-orbitron uppercase tracking-tighter">FOR THE COS</div>
        </div>
      </div>
    </div>
  );

  if (exportSide === 'front') return <div className="w-full h-full relative" style={{ aspectRatio: '3/4' }}>{FrontSide}</div>;
  if (exportSide === 'back') return <div className="w-full h-full relative" style={{ aspectRatio: '3/4' }}>{BackSide}</div>;

  return (
    <div 
      className="relative cursor-pointer perspective-1000 group w-full h-full mx-auto" 
      onClick={(e) => {
        e.stopPropagation();
        onFlip();
      }}
    >
      <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        {FrontSide}
        {BackSide}
      </div>
    </div>
  );
};

export default TradingCard;
