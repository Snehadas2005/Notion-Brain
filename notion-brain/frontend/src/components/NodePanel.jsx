import { motion, AnimatePresence } from "framer-motion";
import React from "react";

const NodePanel = ({ node, onClose }) => {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 h-full w-80 bg-gray-900/90 border-l border-indigo-900/40 p-6 backdrop-blur z-50 shadow-2xl overflow-y-auto"
        >
          <div className="flex justify-between items-center mb-6">
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Node Detail</span>
          </div>

          <h2 className="text-white font-bold text-2xl mb-2">{node.label || 'Untitled'}</h2>
          {node.edited && (
            <p className="text-gray-400 text-xs mb-6">
              Last edited: {new Date(node.edited).toLocaleDateString()}
            </p>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Content Snippet</h3>
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-gray-300 text-sm leading-relaxed italic">
                  Select a node to view its neural connections and content snippet...
                </p>
              </div>
            </div>

            {node.url && (
              <a 
                href={node.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-8 block w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-center font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                Open in Notion →
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NodePanel;
