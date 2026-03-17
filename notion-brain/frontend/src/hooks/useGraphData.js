import { useState, useEffect } from "react";

const useGraphData = () => {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/api/graph`)
      .then(r => r.json())
      .then(d => { 
        // Ensure data is in the correct format
        const nodes = Array.isArray(d.nodes) ? d.nodes : [];
        const links = Array.isArray(d.links) ? d.links : [];
        setData({ nodes, links }); 
        setLoading(false); 
      })
      .catch(err => {
        console.error("Failed to fetch graph data:", err);
        setLoading(false);
      });
  }, []);

  return { data, loading };
};

export default useGraphData;
