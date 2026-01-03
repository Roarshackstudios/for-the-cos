import React, { useRef } from 'react';
import { Category, Subcategory } from '../types';

interface CarouselProps {
  items: (Category | Subcategory)[];
  onItemSelect: (item: any) => void;
  title?: string;
  isSubView?: boolean;
  onBack?: () => void;
  onConfirm?: () => void;
  selectedIndex?: number | null;
}

const Carousel: React.FC<CarouselProps> = ({ 
  items, 
  onItemSelect, 
  title, 
  isSubView, 
  onBack, 
  onConfirm,
  selectedIndex
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full overflow-hidden">
      <div className="flex flex-col md:flex-row items-center justify-between mb-24 px-16 space-y-10 md:space-y-0">
        {isSubView && (
          <button onClick={onBack} className="action-btn-red !text-xl">BACK</button>
        )}
        <h2 className={`text-[8rem] md:text-[11rem] font-comic italic uppercase tracking-tighter -rotate-1 ${isSubView ? 'comic-text-yellow' : 'comic-text-3d'}`}>
          {title}
        </h2>
        {isSubView && onConfirm && (
          <button 
            onClick={onConfirm}
            className={`action-btn-yellow scale-125 ${selectedIndex !== null ? 'opacity-100' : 'opacity-20 cursor-not-allowed'}`}
          >
            CONFIRM!
          </button>
        )}
      </div>

      <div className="relative group px-10">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-8 bg-white border-8 border-black opacity-0 group-hover:opacity-100 transition-all text-black shadow-xl"
        >
          <i className="fa-solid fa-chevron-left text-5xl"></i>
        </button>

        <div 
          ref={scrollRef}
          className="flex space-x-20 overflow-x-auto pb-32 px-16 custom-scrollbar scroll-smooth snap-x"
        >
          {items.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div 
                key={item.id}
                onClick={() => onItemSelect(item)}
                className={`flex-shrink-0 w-80 md:w-[500px] cursor-pointer snap-center transition-all transform ${isSelected ? 'scale-105' : 'opacity-40 hover:opacity-100'}`}
              >
                <div className={`relative h-[55rem] bg-white border-8 border-black shadow-[20px_20px_0px_#660000] transition-all overflow-hidden ${isSelected ? 'scale-105 rotate-1 border-[#e21c23]' : ''}`}>
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover grayscale-[0.3] hover:grayscale-0 transition-all"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-12 text-white">
                    <h3 className="text-6xl md:text-8xl font-comic italic uppercase tracking-tighter drop-shadow-[4px_4px_0px_#660000]">{item.name}</h3>
                    <p className="text-zinc-300 text-2xl font-comic uppercase mt-4 tracking-widest">{item.description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-10 right-10 bg-[#fde910] p-8 border-8 border-black animate-kaboom">
                      <i className="fa-solid fa-crosshairs text-black text-5xl"></i>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-8 bg-white border-8 border-black opacity-0 group-hover:opacity-100 transition-all text-black shadow-xl"
        >
          <i className="fa-solid fa-chevron-right text-5xl"></i>
        </button>
      </div>
    </div>
  );
};

export default Carousel;