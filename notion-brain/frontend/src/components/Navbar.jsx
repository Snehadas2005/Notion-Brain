import React from 'react';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-[#050814]/80 backdrop-blur-md border-b border-white/10 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">N</span>
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          Notion Brain
        </h1>
      </div>
      
      <div className="flex items-center gap-6">
        <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Documentation</button>
        <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Settings</button>
        <div className="w-8 h-8 bg-white/10 rounded-full border border-white/20"></div>
      </div>
    </nav>
  );
};

export default Navbar;
