"use client";

import { useState, useMemo } from "react";
import {
    Layers, Network, Map, Lightbulb,
    AlertTriangle, CheckCircle2, Info, Folder,
    ChevronDown, ChevronRight, TrendingUp, GitBranch, FileText
} from "lucide-react";

interface ArchitectureOverviewProps {
    analysisData: any;
}

// ─── Complexity Treemap ───────────────────────────────────────────────────────

function complexityColor(cx: number, alpha = '20') {
    if (cx >= 20) return { bg: `#ef4444${alpha}`, border: '#ef444450', text: '#fca5a5' };
    if (cx >= 10) return { bg: `#f59e0b${alpha}`, border: '#f59e0b50', text: '#fcd34d' };
    if (cx >= 5)  return { bg: `#3b82f6${alpha}`, border: '#3b82f650', text: '#93c5fd' };
    return { bg: `#10b981${alpha}`, border: '#10b98150', text: '#6ee7b7' };
}

function ComplexityTreemap({ files }: { files: any[] }) {
    const [hoveredFile, setHoveredFile] = useState<string | null>(null);

    const groups = useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const file of files) {
            const parts = file.path.split('/');
            const dir = parts.length > 1 ? parts[0] : '(root)';
            if (!map[dir]) map[dir] = [];
            map[dir].push(file);
        }
        return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
    }, [files]);

    return (
        <div className="space-y-5">
            {/* Legend */}
            <div className="flex items-center gap-5 text-xs text-slate-500">
                {[
                    { label: 'Low (<5)', color: '#10b981' },
                    { label: 'Moderate (5–9)', color: '#3b82f6' },
                    { label: 'High (10–19)', color: '#f59e0b' },
                    { label: 'Critical (20+)', color: '#ef4444' },
                ].map(({ label, color }) => (
                    <span key={label} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color + '40', border: `1px solid ${color}60` }} />
                        {label}
                    </span>
                ))}
            </div>

            {groups.map(([dir, dirFiles]) => {
                const dirComplexity = dirFiles.reduce((s: number, f: any) => s + (f.complexity ?? 0), 0);
                const avgCx = dirFiles.length > 0 ? dirComplexity / dirFiles.length : 0;
                const c = complexityColor(avgCx);
                return (
                    <div key={dir}>
                        {/* Directory header */}
                        <div className="flex items-center gap-2 mb-2">
                            <Folder size={13} className="text-slate-500" />
                            <span className="text-xs font-mono font-medium text-slate-300">{dir}/</span>
                            <span className="text-xs text-slate-600">{dirFiles.length} file{dirFiles.length !== 1 ? 's' : ''}</span>
                            <div className="flex-1 h-px bg-white/5 mx-2" />
                            <span className="text-xs" style={{ color: c.text }}>avg cx {avgCx.toFixed(1)}</span>
                        </div>

                        {/* File chips */}
                        <div className="flex flex-wrap gap-1.5 pl-4">
                            {dirFiles.map((file: any) => {
                                const name = file.path.split('/').pop() || file.path;
                                const cx = file.complexity ?? 0;
                                const fc = complexityColor(cx);
                                const isHov = hoveredFile === file.path;
                                return (
                                    <div
                                        key={file.path}
                                        onMouseEnter={() => setHoveredFile(file.path)}
                                        onMouseLeave={() => setHoveredFile(null)}
                                        style={{ background: fc.bg, borderColor: fc.border }}
                                        className="relative px-2.5 py-1.5 rounded-lg border text-xs font-mono cursor-default transition-all duration-150 select-none"
                                    >
                                        <span className="text-slate-300">{name}</span>
                                        {/* Complexity dot */}
                                        <span
                                            className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle"
                                            style={{ background: fc.border }}
                                        />
                                        {/* Tooltip */}
                                        {isHov && (
                                            <div className="absolute bottom-full left-0 mb-2 z-20 bg-[#0d0d0d] border border-white/10 rounded-xl p-3 text-xs whitespace-nowrap shadow-2xl pointer-events-none">
                                                <div className="text-white font-medium mb-2 font-mono">{file.path}</div>
                                                <div className="space-y-1 text-slate-400">
                                                    <div>Complexity: <span style={{ color: fc.text }} className="font-medium">{cx}</span></div>
                                                    {file.functions?.length > 0 && <div>Functions: <span className="text-slate-300">{file.functions.length}</span></div>}
                                                    {file.exports?.length > 0 && <div>Exports: <span className="text-slate-300">{file.exports.length}</span></div>}
                                                    {file.imports?.length > 0 && <div>Imports: <span className="text-slate-300">{file.imports.length}</span></div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Layer Stack Diagram ──────────────────────────────────────────────────────

const LAYER_PALETTE = [
    { border: 'border-purple-500/30', activeBg: 'bg-purple-500/10', dot: '#a855f7', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    { border: 'border-blue-500/30',   activeBg: 'bg-blue-500/10',   dot: '#3b82f6', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { border: 'border-cyan-500/30',   activeBg: 'bg-cyan-500/10',   dot: '#06b6d4', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { border: 'border-green-500/30',  activeBg: 'bg-green-500/10',  dot: '#10b981', badge: 'bg-green-500/20 text-green-300 border-green-500/30' },
    { border: 'border-amber-500/30',  activeBg: 'bg-amber-500/10',  dot: '#f59e0b', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
];

function LayerStackDiagram({ layers, files }: { layers: any[]; files: any[] }) {
    const [openLayer, setOpenLayer] = useState<string | null>(null);

    const fileComplexityMap = useMemo(() => {
        const m: Record<string, number> = {};
        for (const f of files) m[f.path] = f.complexity ?? 0;
        return m;
    }, [files]);

    // Count cross-layer edges using graph data (approximate via file paths)
    function getCrossLayerCalls(srcFiles: string[], dstFiles: string[]) {
        let count = 0;
        const dstSet = new Set<string>(dstFiles);
        for (const f of files) {
            if (!srcFiles.includes(f.path)) continue;
            for (const imp of (f.imports || [])) {
                if (imp.resolved && dstSet.has(imp.resolved)) count++;
            }
        }
        return count;
    }

    return (
        <div className="relative">
            {layers.map((layer: any, i: number) => {
                const palette = LAYER_PALETTE[i % LAYER_PALETTE.length];
                const isOpen = openLayer === layer.name;
                const cxValues = layer.files.map((f: string) => fileComplexityMap[f] ?? 0);
                const avgCx = cxValues.length > 0 ? cxValues.reduce((a: number, b: number) => a + b, 0) / cxValues.length : 0;
                const nextLayer = layers[i + 1];
                const crossCalls = nextLayer ? getCrossLayerCalls(layer.files, nextLayer.files) : 0;

                return (
                    <div key={layer.name}>
                        {/* Layer card */}
                        <div
                            onClick={() => setOpenLayer(isOpen ? null : layer.name)}
                            className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${palette.border} ${isOpen ? palette.activeBg : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: palette.dot }} />
                                    <span className="text-sm font-medium text-white">{layer.name}</span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full border ${palette.badge}`}>
                                        {layer.files.length} files
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-500">avg cx {avgCx.toFixed(1)}</span>
                                    {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 mb-3 pl-6">{layer.description}</p>

                            {/* Complexity mini-bar */}
                            <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/5 pl-6">
                                {layer.files.slice(0, 24).map((f: string, fi: number) => {
                                    const cx = fileComplexityMap[f] ?? 0;
                                    const col = cx >= 20 ? '#ef4444' : cx >= 10 ? '#f59e0b' : cx >= 5 ? '#3b82f6' : '#10b981';
                                    return <div key={fi} style={{ flex: 1, background: col }} title={`${f.split('/').pop()}: cx ${cx}`} />;
                                })}
                            </div>

                            {/* Expanded file list */}
                            {isOpen && (
                                <div className="mt-4 pl-6 flex flex-wrap gap-1.5">
                                    {layer.files.map((f: string, fi: number) => {
                                        const cx = fileComplexityMap[f] ?? 0;
                                        const fc = complexityColor(cx);
                                        return (
                                            <span
                                                key={fi}
                                                style={{ background: fc.bg, borderColor: fc.border }}
                                                className="px-2 py-1 text-xs font-mono text-slate-300 rounded-lg border"
                                            >
                                                {f.split('/').pop()}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Connector to next layer */}
                        {i < layers.length - 1 && (
                            <div className="flex flex-col items-center py-1 relative">
                                <div className="w-px h-4 bg-white/15" />
                                {crossCalls > 0 && (
                                    <span className="absolute left-1/2 translate-x-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 whitespace-nowrap">
                                        {crossCalls} dep{crossCalls !== 1 ? 's' : ''}
                                    </span>
                                )}
                                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/15" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Coupling Matrix ──────────────────────────────────────────────────────────

function CouplingMatrix({ files }: { files: any[] }) {
    const [hovered, setHovered] = useState<[number, number] | null>(null);

    // Rank files by how many times they are imported by others
    const importCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const file of files) {
            for (const imp of (file.imports || [])) {
                if (imp.resolved) counts[imp.resolved] = (counts[imp.resolved] || 0) + 1;
            }
        }
        return counts;
    }, [files]);

    const topFiles = useMemo(() =>
        [...files]
            .sort((a, b) => (importCounts[b.path] || 0) - (importCounts[a.path] || 0))
            .slice(0, 9),
        [files, importCounts]);

    const importSet = useMemo(() => {
        const s = new Set<string>();
        for (const file of files) {
            for (const imp of (file.imports || [])) {
                if (imp.resolved) s.add(`${file.path}→${imp.resolved}`);
            }
        }
        return s;
    }, [files]);

    if (topFiles.length < 2) {
        return <p className="text-slate-500 text-sm">Not enough cross-referenced files to build a coupling matrix.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <div className="inline-block">
                {/* Rotated column headers */}
                <div className="flex" style={{ paddingLeft: 128 }}>
                    {topFiles.map((f, j) => (
                        <div key={j} style={{ width: 34, height: 88 }} className="flex items-end justify-center pb-1">
                            <div
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, maxHeight: 80 }}
                                className="text-slate-400 truncate font-mono"
                            >
                                {f.path.split('/').pop()}
                            </div>
                        </div>
                    ))}
                    <div style={{ width: 60 }} className="flex items-end pb-1.5">
                        <span className="text-xs text-slate-600 pl-1">← imported by</span>
                    </div>
                </div>

                {/* Matrix rows */}
                {topFiles.map((rowFile, i) => (
                    <div key={i} className="flex items-center mb-0.5">
                        <div style={{ width: 128 }} className="text-xs text-slate-400 font-mono truncate pr-3 text-right">
                            {rowFile.path.split('/').pop()}
                        </div>
                        {topFiles.map((colFile, j) => {
                            const isSelf = i === j;
                            const rowImportsCol = importSet.has(`${rowFile.path}→${colFile.path}`);
                            const colImportsRow = importSet.has(`${colFile.path}→${rowFile.path}`);
                            const mutual = rowImportsCol && colImportsRow;
                            const isHov = hovered?.[0] === i && hovered?.[1] === j;
                            return (
                                <div
                                    key={j}
                                    style={{ width: 34, height: 30 }}
                                    onMouseEnter={() => setHovered([i, j])}
                                    onMouseLeave={() => setHovered(null)}
                                    className={`relative border rounded flex items-center justify-center transition-all cursor-default m-0.5 ${
                                        isSelf
                                            ? 'bg-white/5 border-white/10'
                                            : mutual
                                            ? 'bg-violet-500/30 border-violet-500/40'
                                            : rowImportsCol
                                            ? 'bg-cyan-500/25 border-cyan-500/35'
                                            : 'bg-white/[0.02] border-white/5'
                                    } ${isHov ? 'ring-1 ring-white/25 z-10' : ''}`}
                                >
                                    {mutual && <div className="w-2 h-2 rounded-full bg-violet-400" />}
                                    {!mutual && rowImportsCol && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                                    {isSelf && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}

                                    {isHov && !isSelf && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-2xl pointer-events-none">
                                            {mutual
                                                ? <span className="text-violet-300">Mutual dependency ↔</span>
                                                : rowImportsCol
                                                ? <span className="text-cyan-300">{rowFile.path.split('/').pop()} → imports → {colFile.path.split('/').pop()}</span>
                                                : <span className="text-slate-400">No dependency</span>
                                            }
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {/* Import count badge */}
                        <div style={{ width: 60 }} className="pl-2">
                            {importCounts[rowFile.path] ? (
                                <span className="text-xs text-slate-600">{importCounts[rowFile.path]} ←</span>
                            ) : null}
                        </div>
                    </div>
                ))}

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pl-[128px] text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block bg-cyan-500/25 border border-cyan-500/35" />
                        row → imports → col
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block bg-violet-500/30 border border-violet-500/40" />
                        mutual dependency
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Dependency Flow Graph (SVG) ──────────────────────────────────────────────

function DependencyFlowGraph({ files }: { files: any[] }) {
    // Build a simplified node graph: directories as nodes, inter-dir edges
    const { nodes, edges } = useMemo(() => {
        const dirMap: Record<string, { fileCount: number; totalCx: number }> = {};
        for (const f of files) {
            const dir = f.path.includes('/') ? f.path.split('/')[0] : '(root)';
            if (!dirMap[dir]) dirMap[dir] = { fileCount: 0, totalCx: 0 };
            dirMap[dir].fileCount++;
            dirMap[dir].totalCx += (f.complexity ?? 0);
        }

        const dirs = Object.keys(dirMap);
        const n = dirs.length;
        const R = 130;
        const svgCx = 200, svgCy = 170;

        type GraphNode = { id: string; x: number; y: number; avgCx: number; fileCount: number; col: string; label: string };
        type GraphEdge = { src: GraphNode; dst: GraphNode; weight: number };

        const nodeList: GraphNode[] = dirs.map((dir, i) => {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            const x = svgCx + R * Math.cos(angle);
            const y = svgCy + R * Math.sin(angle);
            const info = dirMap[dir];
            const avgCx = info.fileCount > 0 ? info.totalCx / info.fileCount : 0;
            const col = avgCx >= 20 ? '#ef4444' : avgCx >= 10 ? '#f59e0b' : avgCx >= 5 ? '#3b82f6' : '#10b981';
            return { id: dir, x, y, avgCx, fileCount: info.fileCount, col, label: dir };
        });

        const edgeCounts: Record<string, number> = {};
        for (const file of files) {
            const srcDir = file.path.includes('/') ? file.path.split('/')[0] : '(root)';
            for (const imp of (file.imports || [])) {
                if (!imp.resolved) continue;
                const dstDir = imp.resolved.includes('/') ? imp.resolved.split('/')[0] : '(root)';
                if (srcDir === dstDir) continue;
                const key = `${srcDir}→${dstDir}`;
                edgeCounts[key] = (edgeCounts[key] || 0) + 1;
            }
        }

        const edgeList: GraphEdge[] = Object.entries(edgeCounts)
            .filter(([, w]) => w > 0)
            .flatMap(([key, weight]) => {
                const [src, dst] = key.split('→');
                const s = nodeList.find(nd => nd.id === src);
                const d = nodeList.find(nd => nd.id === dst);
                return (s && d) ? [{ src: s, dst: d, weight }] : [];
            });

        return { nodes: nodeList, edges: edgeList };
    }, [files]);

    const [activeNode, setActiveNode] = useState<string | null>(null);

    if (nodes.length < 2) return null;

    const maxWeight = Math.max(...edges.map(e => e.weight), 1);
    const maxFiles = Math.max(...nodes.map(n => n.fileCount), 1);

    return (
        <svg viewBox="0 0 400 340" className="w-full max-w-[420px] mx-auto" style={{ height: 340 }}>
            <defs>
                <marker id="arrowhead" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                    <polygon points="0 0, 7 2.5, 0 5" fill="#334155" />
                </marker>
                <marker id="arrowhead-active" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
                    <polygon points="0 0, 7 2.5, 0 5" fill="#06b6d4" />
                </marker>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
                const isActive = activeNode && (e.src.id === activeNode || e.dst.id === activeNode);
                const opacity = activeNode ? (isActive ? 0.85 : 0.08) : 0.35;
                const strokeW = 0.8 + (e.weight / maxWeight) * 2;
                return (
                    <line
                        key={i}
                        x1={e.src.x} y1={e.src.y}
                        x2={e.dst.x} y2={e.dst.y}
                        stroke={isActive ? '#06b6d4' : '#334155'}
                        strokeWidth={strokeW}
                        strokeOpacity={opacity}
                        markerEnd={`url(#${isActive ? 'arrowhead-active' : 'arrowhead'})`}
                    />
                );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
                const r = 14 + (node.fileCount / maxFiles) * 16;
                const isActive = activeNode === node.id;
                const isDimmed = activeNode && !isActive;
                return (
                    <g
                        key={node.id}
                        onMouseEnter={() => setActiveNode(node.id)}
                        onMouseLeave={() => setActiveNode(null)}
                        style={{ cursor: 'default' }}
                    >
                        <circle
                            cx={node.x} cy={node.y} r={r}
                            fill={node.col + (isDimmed ? '15' : '25')}
                            stroke={node.col}
                            strokeWidth={isActive ? 2 : 1}
                            strokeOpacity={isDimmed ? 0.2 : 0.6}
                        />
                        <text
                            x={node.x} y={node.y + 1}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={9} fill={isDimmed ? '#475569' : '#cbd5e1'}
                            fontFamily="monospace"
                        >
                            {node.label.length > 8 ? node.label.slice(0, 7) + '…' : node.label}
                        </text>
                        <text
                            x={node.x} y={node.y + r + 10}
                            textAnchor="middle"
                            fontSize={8} fill={isDimmed ? '#334155' : '#64748b'}
                        >
                            {node.fileCount}f
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const INSIGHT_CONFIG: Record<string, { icon: React.ReactNode; border: string; bg: string; titleColor: string }> = {
    strength:   { icon: <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />,  border: 'border-green-500/20',  bg: 'bg-green-500/5',  titleColor: 'text-green-300'  },
    risk:       { icon: <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />,   border: 'border-red-500/20',    bg: 'bg-red-500/5',    titleColor: 'text-red-300'    },
    suggestion: { icon: <Lightbulb size={15} className="text-blue-400 shrink-0 mt-0.5" />,      border: 'border-blue-500/20',   bg: 'bg-blue-500/5',   titleColor: 'text-blue-300'   },
    warning:    { icon: <Info size={15} className="text-yellow-400 shrink-0 mt-0.5" />,          border: 'border-yellow-500/20', bg: 'bg-yellow-500/5', titleColor: 'text-yellow-300' },
};

export function ArchitectureOverview({ analysisData }: ArchitectureOverviewProps) {
    const arch = analysisData?.architecture;
    const files: any[] = analysisData?.files ?? [];

    const totalFunctions = files.reduce((s: number, f: any) => s + (f.functions?.length ?? 0), 0);
    const avgComplexity = files.length > 0
        ? (files.reduce((s: number, f: any) => s + (f.complexity ?? 0), 0) / files.length).toFixed(1)
        : '0';
    const highComplexityCount = files.filter((f: any) => (f.complexity ?? 0) >= 10).length;

    const hasLayers = arch?.layers && arch.layers.length > 0;
    const hasInsights = arch?.insights && arch.insights.length > 0;
    const hasComponents = arch?.components && arch.components.length > 0;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-light tracking-tight text-white mb-2">Architecture Overview</h1>
                <p className="text-sm text-slate-500">Layer structure, module coupling, and complexity distribution across your codebase.</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-5 gap-4">
                {[
                    { label: 'Pattern',      value: arch?.pattern?.type || 'Unknown',  sub: `${Math.round((arch?.pattern?.confidence || 0) * 100)}% confidence` },
                    { label: 'Layers',       value: arch?.layers?.length ?? 0,         sub: 'architectural tiers' },
                    { label: 'Files',        value: files.length,                      sub: 'total source files' },
                    { label: 'Functions',    value: totalFunctions,                    sub: 'across all files' },
                    { label: 'Avg Cx',       value: avgComplexity,                     sub: `${highComplexityCount} high complexity` },
                ].map((stat, i) => (
                    <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{stat.label}</div>
                        <div className="text-2xl font-light text-white truncate mb-1">{stat.value}</div>
                        <div className="text-xs text-slate-600">{stat.sub}</div>
                    </div>
                ))}
            </div>

            {/* Pattern characteristics */}
            {arch?.pattern?.characteristics?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {arch.pattern.characteristics.map((c: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-cyan-500/10 text-cyan-300 text-xs rounded-full border border-cyan-500/20">{c}</span>
                    ))}
                    {arch.pattern.description && (
                        <span className="px-3 py-1 text-slate-400 text-xs rounded-full border border-white/5 bg-white/[0.02]">{arch.pattern.description}</span>
                    )}
                </div>
            )}

            {/* Layer Stack + Inter-module graph */}
            <div className="grid grid-cols-2 gap-6">
                {hasLayers && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <Layers size={18} className="text-purple-400" />
                            <h2 className="text-lg font-medium text-white">Architecture Layers</h2>
                            <span className="text-xs text-slate-600 ml-auto">click to expand</span>
                        </div>
                        <LayerStackDiagram layers={arch.layers} files={files} />
                    </div>
                )}

                {files.length >= 2 && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <GitBranch size={18} className="text-cyan-400" />
                            <h2 className="text-lg font-medium text-white">Module Dependency Graph</h2>
                            <span className="text-xs text-slate-600 ml-auto">hover to highlight</span>
                        </div>
                        <DependencyFlowGraph files={files} />
                        <p className="text-xs text-slate-600 text-center mt-2">Node size = file count · Color = avg complexity</p>
                    </div>
                )}
            </div>

            {/* Complexity treemap */}
            {files.length > 0 && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Map size={18} className="text-cyan-400" />
                        <h2 className="text-lg font-medium text-white">Complexity Distribution</h2>
                        <span className="text-xs text-slate-600 ml-auto">hover for details</span>
                    </div>
                    <ComplexityTreemap files={files} />
                </div>
            )}

            {/* Coupling matrix + Key components */}
            <div className="grid grid-cols-2 gap-6">
                {files.length >= 3 && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <Network size={18} className="text-blue-400" />
                            <h2 className="text-lg font-medium text-white">Coupling Matrix</h2>
                            <span className="text-xs text-slate-600 ml-auto">top files by import count</span>
                        </div>
                        <CouplingMatrix files={files} />
                    </div>
                )}

                {hasComponents && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <TrendingUp size={18} className="text-green-400" />
                            <h2 className="text-lg font-medium text-white">Key Components</h2>
                        </div>
                        <div className="space-y-3">
                            {arch.components.slice(0, 6).map((comp: any, i: number) => (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                    <FileText size={14} className="text-slate-500 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-slate-200 truncate">{comp.name}</span>
                                            <span className={`px-1.5 py-0.5 text-xs rounded shrink-0 ${
                                                comp.complexity === 'high'   ? 'bg-red-500/20 text-red-400' :
                                                comp.complexity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-green-500/20 text-green-400'
                                            }`}>{comp.complexity}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 capitalize mb-1.5">{comp.type?.replace('-', ' ')}</div>
                                        {comp.responsibilities?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {comp.responsibilities.slice(0, 3).map((r: string, j: number) => (
                                                    <span key={j} className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{r}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Insights */}
            {hasInsights && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Lightbulb size={18} className="text-yellow-400" />
                        <h2 className="text-lg font-medium text-white">Architecture Insights</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {arch.insights.map((insight: any, i: number) => {
                            const config = INSIGHT_CONFIG[insight.type] ?? INSIGHT_CONFIG.warning;
                            return (
                                <div key={i} className={`border rounded-xl p-4 ${config.border} ${config.bg}`}>
                                    <div className="flex items-start gap-3">
                                        {config.icon}
                                        <div>
                                            <h3 className={`font-medium text-sm mb-1 ${config.titleColor}`}>{insight.title}</h3>
                                            <p className="text-xs text-slate-400">{insight.description}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
