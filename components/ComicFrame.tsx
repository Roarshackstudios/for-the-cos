
import React from 'react';

interface ComicFrameProps {
  category: string;
  subcategory: string;
  customTitle?: string;
}

const ComicFrame: React.FC<ComicFrameProps> = ({ category, subcategory, customTitle }) => {
  const date = new Date().toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
  const logoUrl = "https://i.ibb.co/nMbLsyGc/b3d20785-6f2c-4eac-b8a7-6bea68172314.png";

  const rawTitle = customTitle || (subcategory === 'Auto Detect' ? category : subcategory);
  
  // Stricter character limit for the title to prevent collision with the price badge.
  const displayTitle = rawTitle.length > 24 ? rawTitle.substring(0, 21) + "..." : rawTitle;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none overflow-hidden">
      {/* Left Info Badge (25¢ Box) */}
      <div className="absolute top-0 left-0 w-20 bg-white border-r-4 border-b-4 border-black p-1 text-black flex flex-col items-center shadow-md">
        <div className="text-[9px] font-black border-b border-black w-full text-center truncate uppercase tracking-tighter">{category}</div>
        <div className="text-2xl font-black leading-none py-1 font-comic">25¢</div>
        <div className="text-[8px] font-bold text-center leading-none uppercase">
          {date.split(' ')[0]}<br/>{date.split(' ')[1]}
        </div>
      </div>

      {/* 
          Main Title 
          - Increased horizontal padding (px-28) to ensure clear distance from the badge.
          - Use overflow-visible to ensure italics aren't clipped.
      */}
      <div className="absolute top-8 left-0 right-0 flex justify-center px-28">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-comic italic text-red-600 uppercase tracking-tight drop-shadow-[2px_2px_0px_rgba(255,255,255,1)] drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] text-center leading-[0.85] transform -rotate-1 line-clamp-2 w-full break-words overflow-visible">
          {displayTitle}
        </h2>
      </div>

      {/* Bottom Left Logo Box */}
      <div className="absolute bottom-4 left-4 w-20 h-20 bg-white border-4 border-black p-1 shadow-lg overflow-hidden flex items-center justify-center">
        <img src={logoUrl} crossOrigin="anonymous" alt="For The Cos Logo" className="w-full h-auto object-contain" />
      </div>

      {/* Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBgYAAAD8puLMAAAAOnRFWHRDcmVhdGlvbiBUaW1lAFR1ZSAyNyBKdWwgMjAxMCAxMzo1Nzo0OCAtMDAwMHg56mUAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfaBxsNOCiVdG9JAAABNElEQVRo3u2XwQ3CMAxF70V66TpswAbMAqzALMAKbMAW7MB09BI2oBephS9K+S9VlVpC+Xm2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyX8PwAAAP//5m6T0gAAAMlJREFUOBHtlL0RgzAMhO8oGIBZmIAZmAAsQA9MQA/MQA9MQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA9O/D8DAAAA//8ZpHTRAAAAyUlEQVRYR+2XwQ3CMAxF70V66TpswAbMAqzALMAKbMAW7MB09BI2oBephS9K+S9VlVpC+Xm2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyX8PwAAAP//5m6T0gAAAMlJREFUOBHtlL0RgzAMhO8oGIBZmIAZmAAsQA9MQA/MQA9MQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA8uQA9O/D8DAAAA//8ZpHTRAAAAyUlEQVRYR+2XwQ3CMAxF70V66TpswAbMAqzALMAKbMAW7MB09BI2oBephS9K+S9VlVpC+Xm2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YyW2YX8PwAAAP//5m6T0gAAAABJRU5ErkJggg==')]"></div>
    </div>
  );
};

export default ComicFrame;
