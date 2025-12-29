
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
      <div className="flex items-center justify-between mb-8 px-4">
        {isSubView && (
          <button 
            onClick={onBack}
            className="p-3 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        )}
        <h2 className={`flex-grow text-center text-3xl font-orbitron font-bold tracking-wider ${isSubView ? 'text-purple-400' : 'text-blue-400'}`}>
          {title}
        </h2>
        {isSubView && onConfirm && (
          <button 
            onClick={onConfirm}
            className={`p-3 rounded-xl transition-all ${selectedIndex !== null ? 'bg-green-600 hover:bg-green-500 scale-110 shadow-lg' : 'bg-zinc-800 opacity-50 cursor-not-allowed'}`}
          >
            <i className="fa-solid fa-check"></i>
          </button>
        )}
      </div>

      <div className="relative group">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-4 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        <div 
          ref={scrollRef}
          className="flex space-x-6 overflow-x-auto pb-8 px-8 custom-scrollbar scroll-smooth snap-x"
        >
          {items.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <div 
                key={item.id}
                onClick={() => onItemSelect(item)}
                className={`flex-shrink-0 w-64 md:w-80 cursor-pointer snap-center transition-all duration-300 transform ${isSelected ? 'scale-105 ring-4 ring-blue-500' : 'hover:scale-105 opacity-70 hover:opacity-100'}`}
              >
                <div className="relative h-96 md:h-[30rem] rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-6">
                    <h3 className="text-2xl font-bold font-orbitron">{item.name}</h3>
                    <p className="text-gray-300 text-sm line-clamp-2 mt-2">{item.description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-4 right-4 bg-blue-500 p-2 rounded-full shadow-lg">
                      <i className="fa-solid fa-check text-white"></i>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-4 bg-black/50 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <i className="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};

export default Carousel;
