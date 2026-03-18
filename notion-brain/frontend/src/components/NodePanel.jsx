import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = import.meta.env?.VITE_API_URL || 'http://localhost:8000';

function usePageContent(nodeId) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) { setContent(null); return; }
    setLoading(true);
    fetch(`${API}/api/page/${nodeId}`)
      .then(r => r.json())
      .then(d => { setContent(d.content || null); setLoading(false); })
      .catch(() => { setContent(null); setLoading(false); });
  }, [nodeId]);

  return { content, loading };
}

/* ── Loading dots ── */
function Dots({ manga }) {
  return (
    <div style={{ display:'flex', gap: manga ? 5 : 6, alignItems:'center', padding:'4px 0' }}>
      {[0,1,2].map(i => (
        <motion.div key={i}
          animate={manga ? { scaleY:[1,2.6,1] } : { opacity:[0.2,1,0.2] }}
          transition={{ delay: i*0.14, repeat:Infinity, duration: manga ? 0.6 : 1 }}
          style={{
            width: manga ? 7 : 5, height: manga ? 14 : 5,
            background: manga ? '#0d0d0d' : '#6366f1',
            borderRadius: manga ? 2 : '50%',
            transformOrigin:'bottom',
          }}
        />
      ))}
    </div>
  );
}

/* ─── MANGA node panel ─── */
function MangaPanel({ node, onClose }) {
  const { content, loading } = usePageContent(node?.id);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ x: '112%', rotate: 4 }}
          animate={{ x: 0, rotate: 0 }}
          exit={{ x: '112%', rotate: -3 }}
          transition={{ type:'spring', stiffness:260, damping:28 }}
          style={{
            position:'fixed', right:0, top:60, bottom:0, width:308,
            background:'#fffef9',
            border:'3px solid #0d0d0d',
            borderRight:'none',
            boxShadow:'-6px 0 0 #0d0d0d',
            display:'flex', flexDirection:'column',
            overflow:'hidden', zIndex:90,
          }}
        >
          {/* Header strip */}
          <div style={{
            background:'#0d0d0d', padding:'12px 18px',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            flexShrink:0,
          }}>
            <span style={{
              fontFamily:'"Arial Black",sans-serif', fontSize:11,
              letterSpacing:3, color:'#fff', textTransform:'uppercase',
            }}>SELECTED NODE</span>
            <button onClick={onClose} style={{
              background:'#fff', border:'2px solid #fff', color:'#0d0d0d',
              width:24, height:24, cursor:'pointer',
              fontFamily:'"Arial Black",sans-serif', fontWeight:900, fontSize:15,
              display:'flex', alignItems:'center', justifyContent:'center', padding:0,
            }}>×</button>
          </div>

          {/* Diagonal stripe accent */}
          <div style={{
            height:8, flexShrink:0,
            background:'repeating-linear-gradient(45deg,#0d0d0d 0,#0d0d0d 2px,transparent 2px,transparent 7px)',
          }}/>

          {/* Body */}
          <div style={{ padding:'18px 18px 0', flex:1, overflow:'auto' }}>
            <h2 style={{
              fontFamily:'"Arial Black","Arial Bold",sans-serif',
              fontSize:19, fontWeight:900, color:'#0d0d0d',
              textTransform:'uppercase', lineHeight:1.1, letterSpacing:0.5,
              borderBottom:'2.5px solid #0d0d0d', paddingBottom:10, margin:'0 0 10px',
            }}>{node.label || 'UNTITLED'}</h2>

            {node.edited && (
              <p style={{
                fontFamily:'"Georgia",serif', fontStyle:'italic',
                fontSize:11, color:'#777', margin:'0 0 18px',
              }}>
                Last edited: {new Date(node.edited).toLocaleDateString()}
              </p>
            )}

            {/* Content panel */}
            <div style={{
              border:'2px solid #0d0d0d', background:'#f6f2e8',
              padding:14, marginBottom:16,
            }}>
              <div style={{
                fontFamily:'"Arial Black",sans-serif', fontSize:8,
                letterSpacing:2, textTransform:'uppercase', color:'#777', marginBottom:8,
              }}>CONTENT PREVIEW</div>
              {loading
                ? <Dots manga />
                : <p style={{
                    fontFamily:'"Georgia",serif', fontStyle:'italic',
                    fontSize:12, color:'#333', lineHeight:1.65, margin:0,
                    maxHeight:130, overflow:'auto',
                  }}>
                    {content || '"No preview available for this page."'}
                  </p>
              }
            </div>

            {/* Metadata */}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {[
                ['ID', node.id?.slice(0,10)+'...'],
                ['TYPE', node.semantic ? 'SEMANTIC' : 'DIRECT'],
              ].map(([k,v]) => (
                <div key={k} style={{
                  display:'flex', justifyContent:'space-between',
                  borderBottom:'1px solid #e0ddd5', paddingBottom:6,
                }}>
                  <span style={{
                    fontFamily:'"Arial Black",sans-serif', fontSize:8,
                    letterSpacing:1.5, textTransform:'uppercase', color:'#aaa',
                  }}>{k}</span>
                  <span style={{
                    fontFamily:'"Courier New",monospace', fontSize:10,
                    fontWeight:700, color:'#0d0d0d',
                  }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {node.url && (
            <div style={{ padding:'14px 18px', borderTop:'3px solid #0d0d0d', flexShrink:0 }}>
              <a href={node.url} target="_blank" rel="noopener noreferrer"
                style={{
                  display:'block', textAlign:'center', padding:'12px',
                  background:'#0d0d0d', color:'#fff',
                  fontFamily:'"Arial Black",sans-serif', fontSize:10,
                  letterSpacing:2, textTransform:'uppercase', textDecoration:'none',
                  boxShadow:'3px 3px 0 #555', transition:'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={e  => { e.currentTarget.style.transform='translate(2px,2px)'; e.currentTarget.style.boxShadow='1px 1px 0 #555'; }}
                onMouseLeave={e  => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='3px 3px 0 #555'; }}
              >OPEN IN NOTION →</a>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── SPACE node panel ─── */
function SpacePanel({ node, onClose }) {
  const { content, loading } = usePageContent(node?.id);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ x:'100%', opacity:0 }}
          animate={{ x:0, opacity:1 }}
          exit={{ x:'100%', opacity:0 }}
          transition={{ type:'spring', stiffness:210, damping:30 }}
          style={{
            position:'fixed', right:0, top:56, bottom:0, width:316,
            background:'rgba(2,0,14,0.88)',
            backdropFilter:'blur(26px)',
            borderLeft:'1px solid rgba(99,102,241,0.28)',
            display:'flex', flexDirection:'column',
            overflow:'hidden', zIndex:90,
          }}
        >
          {/* Scan line sweep */}
          <motion.div
            animate={{ y:['0%','100%'] }}
            transition={{ repeat:Infinity, duration:3.5, ease:'linear' }}
            style={{
              position:'absolute', left:0, right:0, height:2, zIndex:2, pointerEvents:'none',
              background:'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)',
            }}
          />

          {/* HUD corner brackets */}
          {[
            { top:6, left:6,   borderTop:'1.5px solid rgba(99,102,241,0.6)', borderLeft:'1.5px solid rgba(99,102,241,0.6)' },
            { top:6, right:6,  borderTop:'1.5px solid rgba(99,102,241,0.6)', borderRight:'1.5px solid rgba(99,102,241,0.6)' },
            { bottom:6, left:6,  borderBottom:'1.5px solid rgba(99,102,241,0.6)', borderLeft:'1.5px solid rgba(99,102,241,0.6)' },
            { bottom:6, right:6, borderBottom:'1.5px solid rgba(99,102,241,0.6)', borderRight:'1.5px solid rgba(99,102,241,0.6)' },
          ].map((s, i) => (
            <div key={i} style={{ position:'absolute', width:14, height:14, pointerEvents:'none', zIndex:3, ...s }} />
          ))}

          {/* Header */}
          <div style={{
            padding:'18px 20px 14px',
            borderBottom:'1px solid rgba(99,102,241,0.16)',
            flexShrink:0,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <span style={{
                fontFamily:"'Share Tech Mono','Courier New',monospace",
                fontSize:9, letterSpacing:3.5, color:'rgba(99,102,241,0.65)',
                textTransform:'uppercase',
              }}>NODE · DETAIL</span>
              <button onClick={onClose} style={{
                background:'none',
                border:'1px solid rgba(99,102,241,0.32)',
                color:'rgba(150,155,210,0.55)',
                width:26, height:26, cursor:'pointer',
                fontFamily:"'Share Tech Mono',monospace",
                fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
                padding:0, borderRadius:2, transition:'all 0.15s',
              }}
              onMouseEnter={e  => { e.currentTarget.style.background='rgba(99,102,241,0.15)'; e.currentTarget.style.color='#a5b4fc'; }}
              onMouseLeave={e  => { e.currentTarget.style.background='none'; e.currentTarget.style.color='rgba(150,155,210,0.55)'; }}
              >×</button>
            </div>
            <h2 style={{
              fontFamily:"'Share Tech Mono','Courier New',monospace",
              fontSize:15, fontWeight:700, color:'#eaecff',
              textTransform:'uppercase', letterSpacing:1.2, lineHeight:1.2, margin:'0 0 8px',
            }}>{node.label || 'UNTITLED'}</h2>
            {node.edited && (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#34d399', flexShrink:0 }} />
                <span style={{
                  fontFamily:"'Share Tech Mono',monospace",
                  fontSize:10, color:'rgba(150,155,210,0.45)',
                }}>
                  {new Date(node.edited).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflow:'auto', padding:'18px 20px' }}>
            <div style={{
              fontFamily:"'Share Tech Mono',monospace",
              fontSize:9, letterSpacing:3, color:'rgba(99,102,241,0.6)',
              textTransform:'uppercase', marginBottom:12,
            }}>CONTENT · FRAGMENT</div>

            <div style={{
              background:'rgba(99,102,241,0.05)',
              border:'1px solid rgba(99,102,241,0.15)',
              padding:15, marginBottom:20, minHeight:60,
            }}>
              {loading
                ? <Dots manga={false} />
                : <p style={{
                    fontFamily:"'Share Tech Mono','Courier New',monospace",
                    fontSize:11, color:'rgba(200,205,240,0.7)',
                    lineHeight:1.85, margin:0, maxHeight:180, overflow:'auto',
                  }}>
                    {content || (
                      <em style={{ color:'rgba(150,155,210,0.35)' }}>— no preview available —</em>
                    )}
                  </p>
              }
            </div>

            {/* Metadata rows */}
            <div style={{
              fontFamily:"'Share Tech Mono',monospace",
              fontSize:9, letterSpacing:3, color:'rgba(99,102,241,0.6)',
              textTransform:'uppercase', marginBottom:12,
            }}>NODE · METADATA</div>

            {[
              ['ID',   node.id?.slice(0,13)+'...'],
              ['TYPE', node.semantic ? 'SEMANTIC' : 'DIRECT'],
              ['LINK', 'ACTIVE'],
            ].map(([k,v]) => (
              <div key={k} style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                borderBottom:'1px solid rgba(99,102,241,0.1)', padding:'7px 0',
              }}>
                <span style={{
                  fontFamily:"'Share Tech Mono',monospace",
                  fontSize:9, letterSpacing:2, color:'rgba(150,155,210,0.4)',
                }}>{k}</span>
                <span style={{
                  fontFamily:"'Share Tech Mono',monospace",
                  fontSize:10, color:'#a5b4fc',
                }}>{v}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          {node.url && (
            <div style={{ padding:'14px 20px', borderTop:'1px solid rgba(99,102,241,0.16)', flexShrink:0 }}>
              <motion.a
                href={node.url} target="_blank" rel="noopener noreferrer"
                whileHover={{ backgroundColor:'rgba(99,102,241,0.25)' }}
                style={{
                  display:'block', textAlign:'center', padding:'12px',
                  border:'1px solid rgba(99,102,241,0.5)',
                  background:'rgba(99,102,241,0.1)',
                  color:'#a5b4fc', textDecoration:'none',
                  fontFamily:"'Share Tech Mono','Courier New',monospace",
                  fontSize:11, letterSpacing:3, textTransform:'uppercase',
                  borderRadius:2,
                }}
              >OPEN IN NOTION →</motion.a>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function NodePanel({ node, onClose, isDark }) {
  return isDark
    ? <SpacePanel node={node} onClose={onClose} />
    : <MangaPanel node={node} onClose={onClose} />;
}