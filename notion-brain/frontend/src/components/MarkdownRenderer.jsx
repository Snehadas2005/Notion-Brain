/**
 * MarkdownRenderer.jsx
 * Renders the raw Notion markdown fallback with proper formatting.
 * Handles: bold, italic, strikethrough, code, headings, lists,
 * checkboxes, blockquotes, callouts, dividers, links.
 * Drop this file into: frontend/src/components/MarkdownRenderer.jsx
 */

import React from "react";

// ── Inline markdown parser (bold, italic, code, links, strikethrough) ─────────
function parseInline(text) {
  // Split on markdown tokens, preserve them for reconstruction
  const tokens = [];
  const regex = /(\*\*\*[\s\S]*?\*\*\*|\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|`[^`]+`|~~[\s\S]*?~~|<u>[\s\S]*?<\/u>|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: "text", content: text.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("***")) {
      tokens.push({ type: "bolditalic", content: raw.slice(3, -3) });
    } else if (raw.startsWith("**")) {
      tokens.push({ type: "bold", content: raw.slice(2, -2) });
    } else if (raw.startsWith("*")) {
      tokens.push({ type: "italic", content: raw.slice(1, -1) });
    } else if (raw.startsWith("`")) {
      tokens.push({ type: "code", content: raw.slice(1, -1) });
    } else if (raw.startsWith("~~")) {
      tokens.push({ type: "strike", content: raw.slice(2, -2) });
    } else if (raw.startsWith("<u>")) {
      tokens.push({ type: "underline", content: raw.slice(3, -4) });
    } else if (raw.startsWith("[")) {
      tokens.push({ type: "link", content: match[2], href: match[3] });
    }
    last = match.index + raw.length;
  }
  if (last < text.length) {
    tokens.push({ type: "text", content: text.slice(last) });
  }

  return tokens.map((t, i) => {
    switch (t.type) {
      case "bold":       return <strong key={i}>{t.content}</strong>;
      case "italic":     return <em key={i}>{t.content}</em>;
      case "bolditalic": return <strong key={i}><em>{t.content}</em></strong>;
      case "strike":     return <s key={i}>{t.content}</s>;
      case "underline":  return <u key={i}>{t.content}</u>;
      case "code":       return (
        <code key={i} style={{
          background: "rgba(0,0,0,0.07)", padding: "1px 5px",
          fontFamily: "monospace", fontSize: "12px", borderRadius: 2,
        }}>{t.content}</code>
      );
      case "link": return (
        <a key={i} href={t.href} target="_blank" rel="noreferrer"
          style={{ color: "#000", textDecoration: "underline", fontWeight: 600 }}>
          {t.content}
        </a>
      );
      default: return t.content;
    }
  });
}

// ── Block-level renderer ───────────────────────────────────────────────────────
function renderLine(line, idx) {
  const trimmed = line.trimStart();
  const indent  = line.length - trimmed.length;
  const padLeft = indent * 10;

  // Divider
  if (/^---+$/.test(trimmed)) {
    return <hr key={idx} style={{ border: "none", borderTop: "1.5px solid rgba(0,0,0,0.12)", margin: "14px 0" }} />;
  }

  // Headings
  if (trimmed.startsWith("### ")) {
    return <h3 key={idx} style={{ fontSize: 14, fontWeight: 700, letterSpacing: "1px", margin: "16px 0 4px", textTransform: "uppercase" }}>{parseInline(trimmed.slice(4))}</h3>;
  }
  if (trimmed.startsWith("## ")) {
    return <h2 key={idx} style={{ fontSize: 16, fontWeight: 800, letterSpacing: "1px", margin: "20px 0 6px", textTransform: "uppercase" }}>{parseInline(trimmed.slice(3))}</h2>;
  }
  if (trimmed.startsWith("# ")) {
    return <h1 key={idx} style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", margin: "24px 0 8px", textTransform: "uppercase" }}>{parseInline(trimmed.slice(2))}</h1>;
  }

  // Blockquote / Callout
  if (trimmed.startsWith("> ")) {
    return (
      <blockquote key={idx} style={{
        borderLeft: "3px solid #000", paddingLeft: 12, marginLeft: padLeft,
        color: "#333", fontStyle: "italic", margin: "4px 0 4px " + (padLeft + 12) + "px",
      }}>
        {parseInline(trimmed.slice(2))}
      </blockquote>
    );
  }

  // Code block fence lines (``` or ```lang)
  if (trimmed.startsWith("```")) {
    return null; // handled in block grouping below — skip fence markers
  }

  // Checkbox
  const checkMatch = trimmed.match(/^- \[(x| )\] (.*)$/);
  if (checkMatch) {
    const checked = checkMatch[1] === "x";
    return (
      <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginLeft: padLeft, margin: "2px 0" }}>
        <span style={{
          width: 14, height: 14, border: "1.5px solid #000", display: "inline-block",
          flexShrink: 0, marginTop: 3, background: checked ? "#000" : "transparent",
          position: "relative",
        }}>
          {checked && <span style={{ position: "absolute", top: -1, left: 1, color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
        </span>
        <span style={{ textDecoration: checked ? "line-through" : "none", color: checked ? "#888" : "#000", fontSize: 14 }}>
          {parseInline(checkMatch[2])}
        </span>
      </div>
    );
  }

  // Bullet list
  if (trimmed.startsWith("- ")) {
    return (
      <div key={idx} style={{ display: "flex", gap: 8, marginLeft: padLeft + 4, margin: "2px 0" }}>
        <span style={{ flexShrink: 0, marginTop: 2, fontSize: 10 }}>■</span>
        <span style={{ fontSize: 14, lineHeight: 1.7 }}>{parseInline(trimmed.slice(2))}</span>
      </div>
    );
  }

  // Numbered list
  const numMatch = trimmed.match(/^(\d+)\. (.*)$/);
  if (numMatch) {
    return (
      <div key={idx} style={{ display: "flex", gap: 8, marginLeft: padLeft + 4, margin: "2px 0" }}>
        <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 13, minWidth: 18 }}>{numMatch[1]}.</span>
        <span style={{ fontSize: 14, lineHeight: 1.7 }}>{parseInline(numMatch[2])}</span>
      </div>
    );
  }

  // Emoji icon lines (📄 📎 🔗 etc)
  if (/^[📄📎🔗📌🔑🏷️▶💡⚠️]/.test(trimmed)) {
    return <div key={idx} style={{ fontSize: 14, lineHeight: 1.8, marginLeft: padLeft, margin: "3px 0" }}>{parseInline(trimmed)}</div>;
  }

  // Empty line
  if (!trimmed) {
    return <div key={idx} style={{ height: 8 }} />;
  }

  // Default paragraph
  return (
    <div key={idx} style={{ fontSize: 14, lineHeight: 1.8, marginLeft: padLeft, margin: "2px 0" }}>
      {parseInline(trimmed)}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function MarkdownRenderer({ content, isRaw }) {
  if (!content) return null;

  // For raw Notion markdown (and AI summary), group code blocks then render
  const lines  = content.split("\n");
  const output = [];
  let inCode   = false;
  let codeLang = "";
  let codeLines = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```")) {
      if (!inCode) {
        inCode   = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      } else {
        // Close code block
        output.push(
          <pre key={`code-${idx}`} style={{
            background: "rgba(0,0,0,0.05)", padding: "12px 16px",
            fontFamily: "monospace", fontSize: 12, lineHeight: 1.6,
            overflowX: "auto", margin: "10px 0",
            borderLeft: "3px solid #000",
          }}>
            {codeLang && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 6, opacity: 0.4 }}>{codeLang.toUpperCase()}</div>}
            {codeLines.join("\n")}
          </pre>
        );
        inCode = false;
        codeLines = [];
        codeLang = "";
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    const rendered = renderLine(line, idx);
    if (rendered !== null) output.push(rendered);
  });

  return (
    <div style={{ color: "#111" }}>
      {/* Banner showing this is raw Notion content */}
      {isRaw && (
      <div style={{
        fontSize: 10, letterSpacing: 3, fontWeight: 700, color: "#999",
        borderBottom: "1px solid rgba(0,0,0,0.08)", paddingBottom: 10,
        marginBottom: 20, display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 6, height: 6, background: "#f59e0b", borderRadius: "50%", display: "inline-block" }} />
        RAW_NOTION_CONTENT
      </div>
      )}
      {output}
    </div>
  );
}