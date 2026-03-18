import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SearchIcon = ({ manga }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={manga ? '#0d0d0d' : 'rgba(99,102,241,0.6)'}
    strokeWidth={manga ? 3 : 2} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

/* ── Manga search ── */
function MangaSearch({ value, onChange, onClear }) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      style={{ position: 'fixed', top: 76, left: 24, zIndex: 80, width: 284 }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: '#fff',
        border: focused ? '3px solid #0d0d0d' : '2.5px solid #0d0d0d',
        boxShadow: focused ? '5px 5px 0 #0d0d0d' : '3px 3px 0 #0d0d0d',
        padding: '10px 14px',
        transition: 'box-shadow 0.15s, border 0.15s',
      }}>
        <SearchIcon manga />
        <input
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="SEARCH..."
          style={{
            background: 'none', border: 'none', outline: 'none', flex: 1,
            fontFamily: '"Arial Black","Arial Bold",sans-serif',
            fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#0d0d0d',
          }}
        />
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={onClear}
              style={{
                background: '#0d0d0d', border: 'none', cursor: 'pointer',
                color: '#fff', width: 18, height: 18, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Arial Black",sans-serif', fontSize: 12, fontWeight: 900,
                padding: 0, lineHeight: 1,
              }}
            >×</motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Active query tag */}
      <AnimatePresence>
        {value && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'inline-block', marginTop: 4,
              background: '#0d0d0d', color: '#fff',
              padding: '3px 12px',
              fontFamily: '"Arial Black",sans-serif',
              fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
              boxShadow: '2px 2px 0 #555',
            }}
          >
            SEARCHING: "{value}"
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Space search ── */
function SpaceSearch({ value, onChange, onClear }) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      initial={{ x: -36, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.7, duration: 0.7, ease: 'easeOut' }}
      style={{ position: 'fixed', top: 74, left: 24, zIndex: 80, width: 284 }}
    >
      <div style={{
        position: 'relative',
        background: 'rgba(1,0,10,0.72)',
        backdropFilter: 'blur(18px)',
        border: focused
          ? '1px solid rgba(99,102,241,0.72)'
          : '1px solid rgba(99,102,241,0.25)',
        transition: 'border-color 0.2s',
      }}>
        {/* Corner accents */}
        {[
          { top: -1, left: -1, borderTop:'2px solid rgba(99,102,241,0.7)', borderLeft:'2px solid rgba(99,102,241,0.7)' },
          { bottom: -1, right: -1, borderBottom:'2px solid rgba(99,102,241,0.7)', borderRight:'2px solid rgba(99,102,241,0.7)' },
        ].map((s, i) => (
          <div key={i} style={{ position:'absolute', width:10, height:10, pointerEvents:'none', ...s }} />
        ))}

        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px' }}>
          <SearchIcon manga={false} />
          <input
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="SEARCH NODES..."
            style={{
              background: 'none', border: 'none', outline: 'none', flex: 1,
              fontFamily: "'Share Tech Mono','Courier New',monospace",
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              color: '#dde5ff', caretColor: '#6366f1',
            }}
          />
          <AnimatePresence>
            {value && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={onClear}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'rgba(150,155,210,0.55)', fontSize:16,
                  fontFamily:"'Share Tech Mono',monospace", padding:0, lineHeight:1,
                }}
              >×</motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Animated underline when focused */}
        <AnimatePresence>
          {focused && (
            <motion.div
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position:'absolute', bottom:0, left:0, right:0, height:1,
                background:'linear-gradient(90deg, transparent, rgba(99,102,241,0.85), transparent)',
                transformOrigin:'left',
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function SearchBar({ onSearch, isDark }) {
  const [value, setValue] = useState('');

  const handleChange = useCallback((e) => {
    setValue(e.target.value);
    onSearch(e.target.value);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);

  return isDark
    ? <SpaceSearch value={value} onChange={handleChange} onClear={handleClear} />
    : <MangaSearch  value={value} onChange={handleChange} onClear={handleClear} />;
}