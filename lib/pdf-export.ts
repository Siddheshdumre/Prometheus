/** Converts markdown to clean HTML for the PDF report template */
function markdownToReportHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string): string => {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+?)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+?)\]\([^)]+?\)/g, '<span class="link">$1</span>');
  };

  // Emoji → section accent color
  const EMOJI_COLOR: Record<string, string> = {
    "📋": "#3b82f6", "🛠": "#f59e0b", "🏗": "#a855f7",
    "📁": "#22c55e", "🔄": "#06b6d4", "📦": "#f97316",
    "⚡": "#eab308", "🔍": "#f43f5e",
  };

  function headingColor(text: string): string {
    for (const [emoji, color] of Object.entries(EMOJI_COLOR)) {
      if (text.includes(emoji)) return color;
    }
    return "#e2764a";
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        code.push(esc(lines[i]));
        i++;
      }
      i++;
      out.push(
        `<div class="code-block">${lang ? `<div class="code-lang">${lang}</div>` : ""}<pre>${code.join("\n")}</pre></div>`
      );
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      out.push(`<hr/>`);
      i++;
      continue;
    }

    // H2 section header
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      const color = headingColor(h2[1]);
      out.push(`<div class="section-heading" style="border-left-color:${color};color:${color}">${inline(h2[1])}</div>`);
      i++;
      continue;
    }

    // H3
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      out.push(`<h3>${inline(h3[1])}</h3>`);
      i++;
      continue;
    }

    // H4
    const h4 = line.match(/^####\s+(.+)/);
    if (h4) {
      out.push(`<h4>${inline(h4[1])}</h4>`);
      i++;
      continue;
    }

    // List
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      out.push("<ul>");
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const m = lines[i].match(/^\s*[-*\d.]+\s+(.*)/);
        out.push(`<li>${m ? inline(m[1]) : ""}</li>`);
        i++;
      }
      out.push("</ul>");
      continue;
    }

    // Blank
    if (!line.trim()) { i++; continue; }

    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].match(/^#{1,4}\s+/) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) { para.push(lines[i]); i++; }
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

/** Stats row data */
export interface ReportStats {
  files?: number;
  functions?: number;
  classes?: number;
  dependencies?: number;
  resolvedImports?: number;
  functionCalls?: number;
}

/**
 * Opens a new window with a professional PDF report and triggers the print dialog.
 * Users save it as PDF from there.
 */
export function exportReportAsPdf(
  content: string,
  repoPath: string,
  stats: ReportStats
) {
  const bodyHtml = markdownToReportHtml(content);
  const repoName = repoPath
    ? repoPath.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? repoPath
    : "Repository";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const statRows: { label: string; value: string | number }[] = [
    { label: "Files Analyzed", value: stats.files ?? "—" },
    { label: "Functions", value: stats.functions ?? "—" },
    { label: "Classes", value: stats.classes ?? "—" },
    { label: "Imports", value: stats.dependencies ?? "—" },
    { label: "Resolved Imports", value: stats.resolvedImports != null && stats.dependencies ? `${Math.round((stats.resolvedImports / stats.dependencies) * 100)}%` : (stats.resolvedImports ?? "—") },
    { label: "Call Graph Nodes", value: stats.functionCalls ?? "—" },
  ];

  const statsHtml = statRows
    .map(
      (r) => `<div class="stat-card"><div class="stat-value">${r.value}</div><div class="stat-label">${r.label}</div></div>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Codebase Report — ${repoName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --orange:  #e2764a;
    --orange2: #f97316;
    --ink:     #0f0f0f;
    --ink2:    #1a1a1a;
    --muted:   #6b7280;
    --border:  #e5e7eb;
    --text:    #111827;
    --sub:     #374151;
  }

  html { font-family: 'Inter', system-ui, sans-serif; font-size: 11pt; color: var(--text); background: #fff; }
  body { max-width: 860px; margin: 0 auto; padding: 0; }

  /* ─── Cover / Header ─── */
  .cover {
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1218 55%, #0f0f0f 100%);
    color: #fff;
    padding: 52px 56px 44px;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(226,118,74,0.18) 0%, transparent 70%),
      radial-gradient(ellipse 40% 30% at 95% 5%, rgba(249,115,22,0.10) 0%, transparent 60%);
  }
  .cover-inner { position: relative; z-index: 1; }
  .cover-logo {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 36px;
  }
  .cover-flame {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, var(--orange2), #dc2626);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px;
    box-shadow: 0 0 24px rgba(249,115,22,0.4);
  }
  .cover-brand { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.9); letter-spacing: -0.02em; }
  .cover-brand span { color: var(--orange); }
  .cover-title {
    font-size: 34px; font-weight: 700; letter-spacing: -0.03em;
    line-height: 1.15; margin-bottom: 10px;
    background: linear-gradient(135deg, #fff 40%, rgba(255,255,255,0.7));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .cover-sub {
    font-size: 13px; color: rgba(255,255,255,0.45);
    font-weight: 400; margin-bottom: 28px;
    font-family: 'JetBrains Mono', monospace; letter-spacing: 0.01em;
  }
  .cover-meta {
    display: flex; gap: 24px; flex-wrap: wrap;
  }
  .cover-meta-item {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; color: rgba(255,255,255,0.5);
  }
  .cover-meta-item strong { color: rgba(255,255,255,0.8); font-weight: 500; }
  .cover-divider {
    height: 3px;
    background: linear-gradient(90deg, var(--orange2), #dc2626, transparent);
    margin-top: 0;
  }

  /* ─── Stats grid ─── */
  .stats-section {
    padding: 28px 56px;
    background: #fafafa;
    border-bottom: 1px solid var(--border);
  }
  .stats-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--muted); margin-bottom: 16px;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }
  .stat-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
  }
  .stat-value {
    font-size: 22px; font-weight: 700; color: var(--text);
    font-variant-numeric: tabular-nums; line-height: 1;
    margin-bottom: 5px;
  }
  .stat-label {
    font-size: 9px; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.08em; font-weight: 500;
  }

  /* ─── Body content ─── */
  .content {
    padding: 36px 56px 56px;
  }
  .content-title {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.12em; color: var(--muted); margin-bottom: 28px;
    display: flex; align-items: center; gap: 10px;
  }
  .content-title::after {
    content: ""; flex: 1; height: 1px; background: var(--border);
  }

  .section-heading {
    font-size: 14px; font-weight: 600;
    border-left: 3px solid var(--orange);
    padding: 10px 14px;
    margin: 28px 0 14px;
    background: #f9fafb;
    border-radius: 0 8px 8px 0;
    color: var(--orange);
    page-break-after: avoid;
  }
  h3 {
    font-size: 12px; font-weight: 600; color: var(--sub);
    margin: 18px 0 8px; page-break-after: avoid;
  }
  h4 {
    font-size: 10.5px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.07em;
    margin: 14px 0 6px; page-break-after: avoid;
  }
  p {
    font-size: 10.5pt; color: var(--sub); line-height: 1.75;
    margin-bottom: 10px;
  }
  ul {
    margin: 8px 0 14px 0; padding-left: 0; list-style: none;
  }
  li {
    position: relative; padding-left: 16px;
    font-size: 10.5pt; color: var(--sub); line-height: 1.7;
    margin-bottom: 3px;
  }
  li::before {
    content: "·"; position: absolute; left: 4px;
    color: var(--orange); font-weight: 700;
  }
  strong { font-weight: 600; color: var(--text); }
  em { font-style: italic; color: #4b5563; }
  code {
    font-family: 'JetBrains Mono', monospace; font-size: 9pt;
    background: #f3f4f6; border: 1px solid #e5e7eb;
    border-radius: 4px; padding: 1px 5px; color: #c2410c;
  }
  .link { color: #2563eb; }
  hr {
    border: none; border-top: 1px solid var(--border);
    margin: 20px 0;
  }
  .code-block {
    background: #0f0f0f; border-radius: 8px;
    overflow: hidden; margin: 14px 0;
    page-break-inside: avoid;
  }
  .code-lang {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt; color: #6b7280;
    padding: 7px 14px; border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #1a1a1a; text-transform: uppercase; letter-spacing: 0.08em;
  }
  .code-block pre {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt; color: #86efac; padding: 14px; line-height: 1.65;
    white-space: pre-wrap; word-break: break-all;
  }

  /* ─── Footer ─── */
  .footer {
    border-top: 1px solid var(--border);
    padding: 18px 56px;
    display: flex; justify-content: space-between; align-items: center;
    background: #fafafa;
  }
  .footer-left { font-size: 9px; color: var(--muted); }
  .footer-right { font-size: 9px; color: var(--muted); font-family: 'JetBrains Mono', monospace; }

  /* ─── Print ─── */
  @media print {
    @page {
      size: A4;
      margin: 0;
    }
    body { max-width: 100%; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stats-section { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section-heading { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .code-block { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    a { text-decoration: none; }
  }
</style>
</head>
<body>

<div class="no-print" style="position:fixed;top:16px;right:16px;z-index:100;display:flex;gap:10px;font-family:'Inter',sans-serif;">
  <button onclick="window.print()" style="background:linear-gradient(135deg,#f97316,#dc2626);color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,0.35)">
    ⬇ Save as PDF
  </button>
  <button onclick="window.close()" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:500;cursor:pointer;">
    ✕ Close
  </button>
</div>

<!-- Cover -->
<div class="cover">
  <div class="cover-inner">
    <div class="cover-logo">
      <div class="cover-flame">🔥</div>
      <div class="cover-brand">Prometheus <span>Intelligence</span></div>
    </div>
    <div class="cover-title">Codebase Intelligence<br/>Report</div>
    <div class="cover-sub">${repoName}</div>
    <div class="cover-meta">
      <div class="cover-meta-item"><strong>Repository</strong>${repoName}</div>
      <div class="cover-meta-item"><strong>Generated</strong>${dateStr}</div>
      <div class="cover-meta-item"><strong>Tool</strong>Prometheus v1.0</div>
    </div>
  </div>
</div>
<div class="cover-divider"></div>

<!-- Stats -->
<div class="stats-section">
  <div class="stats-label">Analysis Summary</div>
  <div class="stats-grid">${statsHtml}</div>
</div>

<!-- Overview body -->
<div class="content">
  <div class="content-title">Codebase Overview</div>
  ${bodyHtml}
</div>

<!-- Footer -->
<div class="footer">
  <div class="footer-left">Generated by <strong>Prometheus Codebase Intelligence</strong> · ${dateStr}</div>
  <div class="footer-right">${repoName}</div>
</div>

<script>
  // Auto-open print dialog after fonts load
  window.addEventListener('load', () => setTimeout(() => window.print(), 600));
</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=920,height=860");
  if (!win) {
    alert("Please allow pop-ups to export the PDF report.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
