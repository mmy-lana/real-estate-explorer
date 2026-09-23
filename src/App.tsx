import React, { useState } from 'react';
import { Search, SlidersHorizontal, Map, Grid, Heart } from 'lucide-react';

export default function App(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white font-bold text-lg">
            R
          </div>
          <span className="font-bold text-rose-500 text-xl tracking-tight hidden sm:inline">
            stayexplorer
          </span>
        </div>

        <div className="flex items-center border border-neutral-300 rounded-full py-2 px-4 shadow-sm hover:shadow-md transition cursor-pointer text-sm font-medium gap-3">
          <span>Anywhere</span>
          <span className="w-px h-4 bg-neutral-200" />
          <span>Any week</span>
          <span className="w-px h-4 bg-neutral-200" />
          <span className="text-neutral-500">Add guests</span>
          <div className="p-1.5 bg-rose-500 text-white rounded-full">
            <Search className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 border border-neutral-300 rounded-full px-4 py-2 text-sm font-semibold hover:border-neutral-900 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between pb-6 border-b border-neutral-200">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Explore properties</h1>
            <p className="text-sm text-neutral-500 mt-1">Discover verified stays with verified reviews</p>
          </div>

          <div className="flex items-center border border-neutral-300 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'}`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`p-2 rounded ${viewMode === 'map' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'}`}
              aria-label="Map view"
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="group flex flex-col">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
                <div className="absolute top-3 right-3 z-10">
                  <button
                    type="button"
                    className="p-2 rounded-full bg-white/80 backdrop-blur-sm text-neutral-700 hover:text-rose-500 transition"
                    aria-label="Save listing"
                  >
                    <Heart className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-between items-start text-sm">
                <div className="font-semibold text-neutral-900">Listing Title Sample</div>
                <div className="text-neutral-700">4.92</div>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Beachfront views</p>
              <p className="text-sm font-semibold text-neutral-900 mt-1.5">
                $245 <span className="font-normal text-neutral-500">night</span>
              </p>
            </div>
          ))}
        </div>
      </main>

      <nav className="sm:hidden sticky bottom-0 bg-white border-t border-neutral-200 py-3 px-6 flex justify-around items-center">
        <button type="button" className="flex flex-col items-center gap-1 text-rose-500 text-xs font-medium">
          <Search className="w-5 h-5" />
          <span>Explore</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-neutral-400 text-xs font-medium">
          <Heart className="w-5 h-5" />
          <span>Wishlists</span>
        </button>
      </nav>
    </div>
  );
}
