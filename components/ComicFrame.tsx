import React from 'react';

interface ComicFrameProps {
  category: string;
  subcategory: string;
  customTitle?: string;
  titleOffset?: { x: number; y: number };
  showPriceBadge?: boolean;
  showBrandLogo?: boolean;
}

const ComicFrame: React.FC<ComicFrameProps> = ({ 
  category, 
  subcategory, 
  customTitle, 
  titleOffset = { x: 0, y: 0 },
  showPriceBadge = true,
  showBrandLogo = true
}) => {
  const date = new Date().toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
  const logoUrl = "https://i.ibb.co/nMbLsyGc/b3d20785-6f2c-4eac-b8a7-6bea68172314.png";

  const rawTitle = customTitle || (subcategory === 'Auto Detect' ? category : subcategory);
  const displayTitle = rawTitle.length > 48 ? rawTitle.substring(0, 45) + "..." : rawTitle;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden">
      {/* Corner Price Badge */}
      {showPriceBadge && (
        <div className="absolute top-0 left-0 w-20 md:w-32 bg-white p-2 md:p-3 text-black flex flex-col items-center shadow-2xl">
          <div className="text-[6px] md:text-xs font-black border-b-2 md:border-b-4 border-black w-full text-center truncate uppercase italic mb-1 md:mb-2">{category}</div>
          <div className="text-2xl md:text-5xl font-comic leading-none py-1 text-[#e21c23]">25¢</div>
          <div className="text-[6px] md:text-xs font-black text-center leading-none uppercase mt-1 md:mt-2">
            {date.split(' ')[0]}<br/>{date.split(' ')[1]}
          </div>
        </div>
      )}

      {/* Main Action Title - Movable via transform. Responsive padding. */}
      <div 
        className="absolute top-4 md:top-10 left-0 right-0 flex justify-center px-8 md:px-[15%] transition-transform duration-100"
        style={{ transform: `translate(${titleOffset.x}px, ${titleOffset.y}px)` }}
      >
        <h2 className="text-3xl md:text-7xl font-comic italic text-[#fde910] uppercase tracking-tighter drop-shadow-[2px_2px_0px_#660000] md:drop-shadow-[5px_5px_0px_#660000] text-center leading-[0.8] w-full overflow-visible">
          {displayTitle}
        </h2>
      </div>

      {/* Brand Box */}
      {showBrandLogo && (
        <div className="absolute bottom-4 md:bottom-8 left-4 md:left-8 w-16 h-16 md:w-28 md:h-28 bg-white p-1 md:p-2 shadow-2xl flex items-center justify-center">
          <img src={logoUrl} crossOrigin="anonymous" alt="Logo" className="w-full h-auto object-contain" />
        </div>
      )}

      {/* Halftone Texture Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/halftone-yellow.png')]"></div>
    </div>
  );
};

export default ComicFrame;