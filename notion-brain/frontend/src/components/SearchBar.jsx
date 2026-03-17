import React from 'react';

const SearchBar = ({ onSearch }) => {
  return (
    <div className="absolute top-24 left-8 z-40 w-80">
      <div className="relative">
        <input
          type="text"
          placeholder="Search semantic nodes..."
          className="w-full bg-gray-900/90 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-gray-500 backdrop-blur-sm shadow-2xl"
          onChange={(e) => onSearch(e.target.value)}
        />
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>
  );
};

export default SearchBar;
