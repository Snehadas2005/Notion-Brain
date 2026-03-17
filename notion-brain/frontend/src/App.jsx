import React, { useState } from 'react';
import Universe from './components/Universe.jsx';
import NodePanel from './components/NodePanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import Navbar from './components/Navbar.jsx';
import useGraphData from './hooks/useGraphData.js';

const App = () => {
  const { data, loading } = useGraphData();
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Robust data handling
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const links = Array.isArray(data?.links) ? data.links : [];

  const filteredNodes = nodes.filter(node => 
    (node?.label || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => 
    nodeIds.has(typeof link.source === 'object' ? link.source.id : link.source) && 
    nodeIds.has(typeof link.target === 'object' ? link.target.id : link.target)
  );

  const filteredData = {
    nodes: filteredNodes,
    links: filteredLinks
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050814]">
      <Navbar />
      
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-[#050814]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-indigo-400 font-mono text-sm animate-pulse">Scanning Notion Workspace...</p>
          </div>
        </div>
      ) : (
        <>
          <SearchBar onSearch={setSearchQuery} />
          <div className="w-full h-full z-10">
            <Universe 
              data={filteredData}
              onNodeClick={(node) => setSelectedNode(node)} 
            />
          </div>
          <NodePanel 
            node={selectedNode} 
            onClose={() => setSelectedNode(null)} 
          />
        </>
      )}

      {/* Decorative Glow */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-indigo-500/5 rounded-full blur-[150px]"></div>
      </div>
    </div>
  );
};

export default App;
