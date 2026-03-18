import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [graph, setGraph] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageDetail, setPageDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');

  const fetchGraph = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/graph`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setGraph(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const fetchPages = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/pages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setPages(data.pages || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const fetchPageDetail = async (id) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/page/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setPageDetail(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      setSearchResults(data.results || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>🧠 Notion Brain — API Tester</h1>
      <p style={{ color: '#888' }}>Backend: <code>{API}</code></p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['graph', 'pages', 'page', 'search'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '6px 16px', cursor: 'pointer',
              background: activeTab === t ? '#333' : '#eee',
              color: activeTab === t ? '#fff' : '#000',
              border: '1px solid #ccc', borderRadius: 4 }}>
            {t === 'graph' ? 'GET /graph' : t === 'pages' ? 'GET /pages' : t === 'page' ? 'GET /page/:id' : 'GET /search'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: '#fee', border: '1px solid red', padding: 12, marginBottom: 16, borderRadius: 4 }}>❌ {error}</div>}
      {loading && <div style={{ color: '#888', marginBottom: 16 }}>Loading...</div>}

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <div>
          <button onClick={fetchGraph} style={btnStyle}>Fetch Graph</button>
          {graph && (
            <div>
              <p>✅ <b>{graph.nodes?.length}</b> nodes, <b>{graph.links?.length}</b> links</p>
              <details>
                <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Nodes ({graph.nodes?.length})</summary>
                <table style={tableStyle}>
                  <thead><tr><th>ID</th><th>Label</th><th>URL</th></tr></thead>
                  <tbody>
                    {graph.nodes?.map(n => (
                      <tr key={n.id}>
                        <td><code style={{ fontSize: 11 }}>{n.id?.slice(0, 8)}...</code></td>
                        <td>{n.label || 'Untitled'}</td>
                        <td><a href={n.url} target="_blank" rel="noreferrer" style={{ color: '#0070f3' }}>↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Links ({graph.links?.length})</summary>
                <table style={tableStyle}>
                  <thead><tr><th>Source</th><th>Target</th><th>Semantic</th></tr></thead>
                  <tbody>
                    {graph.links?.map((l, i) => (
                      <tr key={i}>
                        <td><code style={{ fontSize: 11 }}>{(l.source?.id || l.source)?.slice(0, 8)}...</code></td>
                        <td><code style={{ fontSize: 11 }}>{(l.target?.id || l.target)?.slice(0, 8)}...</code></td>
                        <td>{l.semantic ? '🟣 yes' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer' }}>Raw JSON</summary>
                <pre style={preStyle}>{JSON.stringify(graph, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      )}

      {/* Pages Tab */}
      {activeTab === 'pages' && (
        <div>
          <button onClick={fetchPages} style={btnStyle}>Fetch Pages</button>
          {pages.length > 0 && (
            <div>
              <p>✅ <b>{pages.length}</b> pages found</p>
              <table style={tableStyle}>
                <thead><tr><th>ID</th><th>Title</th><th>Last Edited</th><th>Detail</th></tr></thead>
                <tbody>
                  {pages.map(p => (
                    <tr key={p.id}>
                      <td><code style={{ fontSize: 11 }}>{p.id?.slice(0, 8)}...</code></td>
                      <td>{p.title || 'Untitled'}</td>
                      <td style={{ fontSize: 12, color: '#888' }}>{p.last_edited_time?.slice(0, 10)}</td>
                      <td>
                        <button onClick={() => { setActiveTab('page'); fetchPageDetail(p.id); }}
                          style={{ fontSize: 12, cursor: 'pointer', padding: '2px 8px' }}>
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Page Detail Tab */}
      {activeTab === 'page' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input id="pid" placeholder="Paste page ID here..."
              style={{ flex: 1, padding: '6px 10px', fontFamily: 'monospace', border: '1px solid #ccc', borderRadius: 4 }} />
            <button onClick={() => fetchPageDetail(document.getElementById('pid').value.trim())} style={btnStyle}>
              Fetch
            </button>
          </div>
          {pageDetail && (
            <div>
              <p>✅ Page ID: <code>{pageDetail.id}</code></p>
              <h3>Content Preview</h3>
              <pre style={{ ...preStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {pageDetail.content || '(empty)'}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search page titles..."
              style={{ flex: 1, padding: '6px 10px', fontFamily: 'monospace', border: '1px solid #ccc', borderRadius: 4 }} />
            <button onClick={doSearch} style={btnStyle}>Search</button>
          </div>
          {searchResults && (
            <div>
              <p>✅ <b>{searchResults.length}</b> results</p>
              {searchResults.length === 0
                ? <p style={{ color: '#888' }}>No matches found.</p>
                : <table style={tableStyle}>
                    <thead><tr><th>ID</th><th>Title</th><th>Link</th></tr></thead>
                    <tbody>
                      {searchResults.map(r => (
                        <tr key={r.id}>
                          <td><code style={{ fontSize: 11 }}>{r.id?.slice(0, 8)}...</code></td>
                          <td>{r.title}</td>
                          <td><a href={r.url} target="_blank" rel="noreferrer" style={{ color: '#0070f3' }}>↗ Open</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: '8px 20px', cursor: 'pointer', background: '#111',
  color: '#fff', border: 'none', borderRadius: 4, marginBottom: 16, fontSize: 14
};
const tableStyle = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
  border: '1px solid #ddd'
};
const preStyle = {
  background: '#f5f5f5', padding: 16, borderRadius: 4,
  overflow: 'auto', maxHeight: 400, fontSize: 12
};