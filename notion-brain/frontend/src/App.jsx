import React, { useState, useCallback } from 'react';
import Universe from './components/Universe';
import MangaUniverse from './components/MangaUniverse';
import Navbar from './components/Navbar';
import NodePanel from './components/NodePanel';
import SearchBar from './components/SearchBar';
import useGraphData from './hooks/useGraphData';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const { data, loading } = useGraphData();

  const handleSearch = useCallback((q) => {
    if (!q.trim()) { setHighlightNodes(new Set()); return; }
    const matched = new Set(
      data.nodes.filter(n => n.label?.toLowerCase().includes(q.toLowerCase())).map(n => n.id)
    );
    setHighlightNodes(matched);
  }, [data.nodes]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDark(p => !p);
    setSelectedNode(null);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {isDark
        ? <Universe data={data} onNodeClick={handleNodeClick} highlightNodes={highlightNodes} loading={loading} />
        : <MangaUniverse data={data} onNodeClick={handleNodeClick} highlightNodes={highlightNodes} loading={loading} />
      }
      <Navbar isDark={isDark} onToggle={handleToggleTheme} />
      <SearchBar onSearch={handleSearch} isDark={isDark} />
      <NodePanel node={selectedNode} onClose={() => setSelectedNode(null)} isDark={isDark} />
    </div>
  );
}