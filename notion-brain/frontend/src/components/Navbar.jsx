import React from 'react';
import { motion } from 'framer-motion';

/* ── Manga / light-mode navbar ── */
function MangaNav({ onToggle }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 60,
      background: '#fff',
      borderBottom: '3px solid #0d0d0d',
      boxShadow: '0 5px 0 #0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, background: '#0d0d0d', borderRadius: 3,
          border: '2.5px solid #0d0d0d', boxShadow: '2px 2px 0 #555',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontFamily: '"Arial Black",sans-serif', fontWeight: 900, fontSize: 17 }}>N</span>
        </div>
        <div>
          <div style={{
            fontFamily: '"Arial Black","Arial Bold",sans-serif',
            fontWeight: 900, fontSize: 17, letterSpacing: 1.5,
            textTransform: 'uppercase', lineHeight: 1, color: '#0d0d0d',
          }}>NOTION BRAIN</div>
          <div style={{
            fontFamily: '"Georgia",serif', fontStyle: 'italic',
            fontSize: 9, color: '#777', letterSpacing: 0.5, marginTop: 2,
          }}>Knowledge Graph Explorer</div>
        </div>
      </div>

      {/* Nav links + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {['EXPLORE','CLUSTERS','DOCS'].map(label => (
          <button key={label} style={{
            background: 'none', border: 'none', borderBottom: '2px solid transparent',
            cursor: 'pointer', padding: '2px 0',
            fontFamily: '"Arial Black",sans-serif', fontSize: 10,
            letterSpacing: 2, color: '#444', textTransform: 'uppercase',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color='#0d0d0d'; e.currentTarget.style.borderBottomColor='#0d0d0d'; }}
          onMouseLeave={e => { e.currentTarget.style.color='#444'; e.currentTarget.style.borderBottomColor='transparent'; }}
          >{label}</button>
        ))}

        <button onClick={onToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#0d0d0d', color: '#fff',
            border: '2.5px solid #0d0d0d', padding: '7px 18px',
            fontFamily: '"Arial Black",sans-serif', fontSize: 10,
            letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
            boxShadow: '3px 3px 0 #555', transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseDown={e  => { e.currentTarget.style.transform='translate(2px,2px)'; e.currentTarget.style.boxShadow='1px 1px 0 #555'; }}
          onMouseUp={e    => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='3px 3px 0 #555'; }}
          onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='3px 3px 0 #555'; }}
        >
          <span style={{ fontSize: 13 }}>✦</span> SPACE MODE
        </button>
      </div>
    </div>
  );
}

/* ── Space / dark-mode navbar ── */
function SpaceNav({ onToggle }) {
  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: 'rgba(1,0,10,0.65)',
        backdropFilter: 'blur(22px)',
        borderBottom: '1px solid rgba(99,102,241,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Spinning conic orb */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #6366f1, #a855f7, #38bdf8, #34d399, #6366f1)',
            flexShrink: 0, position: 'relative',
            boxShadow: '0 0 14px rgba(99,102,241,0.5)',
          }}
        >
          <div style={{
            position: 'absolute', inset: 6, borderRadius: '50%',
            background: 'rgba(1,0,10,0.92)',
          }} />
        </motion.div>

        <div>
          <div style={{
            fontFamily: "'Share Tech Mono','Courier New',monospace",
            fontSize: 13, letterSpacing: 4, textTransform: 'uppercase',
            background: 'linear-gradient(90deg, #a5b4fc, #e0e7ff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}>NOTION·BRAIN</div>
          <div style={{
            fontFamily: "'Share Tech Mono','Courier New',monospace",
            fontSize: 8, color: 'rgba(150,155,210,0.42)', letterSpacing: 3, marginTop: 3,
          }}>KNOWLEDGE GRAPH EXPLORER</div>
        </div>
      </div>

      {/* Links + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {['EXPLORE','CLUSTERS','DOCS'].map(label => (
          <button key={label} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Share Tech Mono','Courier New',monospace",
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            color: 'rgba(150,155,210,0.5)', transition: 'color 0.2s', padding: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color='#a5b4fc'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(150,155,210,0.5)'}
          >{label}</button>
        ))}

        <motion.button
          onClick={onToggle}
          whileHover={{ backgroundColor: 'rgba(99,102,241,0.22)' }}
          whileTap={{ scale: 0.96 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.45)',
            color: '#a5b4fc', padding: '7px 18px', cursor: 'pointer',
            fontFamily: "'Share Tech Mono','Courier New',monospace",
            fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
            borderRadius: 3,
          }}
        >
          <span style={{ fontSize: 13 }}>☀</span> MANGA MODE
        </motion.button>
      </div>
    </motion.nav>
  );
}

export default function Navbar({ isDark, onToggle }) {
  return isDark
    ? <SpaceNav onToggle={onToggle} />
    : <MangaNav onToggle={onToggle} />;
}