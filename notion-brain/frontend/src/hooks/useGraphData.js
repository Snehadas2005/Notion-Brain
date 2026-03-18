import { useState, useEffect } from 'react';

const API = import.meta.env?.VITE_API_URL || 'http://localhost:8000';

export default function useGraphData() {
  const [data, setData]       = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/graph`)
      .then(r => r.json())
      .then(d => {
        setData({
          nodes: Array.isArray(d.nodes) ? d.nodes : [],
          links: Array.isArray(d.links) ? d.links : [],
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Graph fetch failed:', err);
        setLoading(false);
      });
  }, []);

  return { data, loading };
}