"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { BrainCircuit, FolderTree, GitGraph, LayoutDashboard, SearchCode, Settings, Sparkles, FolderCode, Loader2 } from "lucide-react";
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type NavItem = "Dashboard" | "Architecture" | "Graph Explorer" | "AI Chat" | "Impact Analyzer" | "File Explorer" | "Settings";

const navItems: { label: NavItem; icon: React.ElementType }[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "File Explorer", icon: FolderCode },
  { label: "Architecture", icon: FolderTree },
  { label: "Graph Explorer", icon: GitGraph },
  { label: "AI Chat", icon: BrainCircuit },
  { label: "Impact Analyzer", icon: SearchCode },
  { label: "Settings", icon: Settings }
];

const generateGraphLayout = (nodes: any[], edges: any[]) => {
  // Group nodes by directory for better clustering  
  const nodesByGroup = nodes.reduce((acc, node) => {
    const group = node.group || 'root';
    if (!acc[group]) acc[group] = [];
    acc[group].push(node);
    return acc;
  }, {} as { [key: string]: any[] });
  
  let globalY = 0;
  const positioned = [];

  Object.entries(nodesByGroup).forEach(([group, groupNodes]) => {
    groupNodes.forEach((node, idx) => {
      const isExternal = node.type === 'external';
      positioned.push({
        ...node,
        data: { 
          label: node.label || node.id.split('/').pop() || node.id,
          complexity: node.complexity,
          size: node.size
        },
        position: { 
          x: (idx % 4) * 220 + Math.random() * 15,
          y: globalY + Math.floor(idx / 4) * 100 + Math.random() * 15
        },
        style: {
          background: isExternal ? '#374151' : node.complexity > 10 ? '#dc2626' : node.complexity > 5 ? '#f59e0b' : '#1e293b',
          color: '#e2e8f0',
          border: isExternal ? '1px solid #6b7280' : '1px solid #334155',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '10px',
          minWidth: '120px'
        },
        className: isExternal ? 'external-node' : 'file-node'
      });
    });
    globalY += Math.ceil(groupNodes.length / 4) * 100 + 60;
  });
  
  return positioned;
};

// Helper function to filter and simplify the graph
const filterGraph = (nodes: any[], edges: any[], filter: string, maxConnections: number, showOnlyDirectDeps: boolean) => {
  let filteredNodes = nodes;
  let filteredEdges = edges;
  
  // Text filter
  if (filter.trim()) {
    filteredNodes = nodes.filter(node => 
      (node.data?.label || node.id).toLowerCase().includes(filter.toLowerCase())
    );
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }
  
  // Limit connections per node to reduce visual complexity
  if (maxConnections > 0) {
    const connectionCounts = new Map();
    const limitedEdges = [];
    
    for (const edge of filteredEdges) {
      const sourceCount = connectionCounts.get(edge.source) || 0;
      const targetCount = connectionCounts.get(edge.target) || 0;
      
      if (sourceCount < maxConnections && targetCount < maxConnections) {
        limitedEdges.push(edge);
        connectionCounts.set(edge.source, sourceCount + 1);
        connectionCounts.set(edge.target, targetCount + 1);
      }
    }
    filteredEdges = limitedEdges;
  }
  
  // Remove isolated nodes after filtering edges
  const connectedNodeIds = new Set();
  filteredEdges.forEach((edge: any) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  
  if (!filter.trim()) { // Only remove isolated nodes if no search filter
    filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
  }
  
  return { nodes: filteredNodes, edges: filteredEdges };
};

const metrics = [
  ["Files", "320"],
  ["Functions", "1,200"],
  ["Services", "7"],
  ["Dependencies", "560"]
];

export function Workspace() {
  const [activeTab, setActiveTab] = useState<NavItem>("Dashboard");
  const [repoPathInput, setRepoPathInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [graphFilter, setGraphFilter] = useState('');
  const [maxConnections, setMaxConnections] = useState(3);
  const [showOnlyDirectDeps, setShowOnlyDirectDeps] = useState(true);

  // AI Chat State
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Store raw graph data for filtering
  const [rawGraphData, setRawGraphData] = useState<{nodes: any[], edges: any[]} | null>(null);

  // Effect to re-filter graph when controls change
  useEffect(() => {
    if (rawGraphData && analysisData) {
      const { nodes: filteredNodes, edges: filteredEdges } = filterGraph(
        rawGraphData.nodes, 
        rawGraphData.edges, 
        graphFilter, 
        maxConnections, 
        showOnlyDirectDeps
      );
      setNodes(filteredNodes);
      setEdges(filteredEdges);
    }
  }, [graphFilter, maxConnections, showOnlyDirectDeps, rawGraphData, setNodes, setEdges]);

  const handleAnalyze = async () => {
    if (!repoPathInput) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/repo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath: repoPathInput })
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisData(data.data);

        // Format data for ReactFlow with enhanced layout and filtering
        if (data.data.graph) {
          const rawNodes = generateGraphLayout(data.data.graph.nodes, data.data.graph.edges);
          const rawEdges = data.data.graph.edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: e.type === 'calls',
            style: { 
              stroke: e.type === 'calls' ? '#f59e0b' : '#06b6d4',
              strokeWidth: Math.min(e.weight || 1, 3)
            },
            label: e.type === 'calls' ? 'calls' : '',
            labelStyle: { fontSize: '10px', fill: '#94a3b8' }
          }));
          
          // Store raw data for filtering
          setRawGraphData({ nodes: rawNodes, edges: rawEdges });
          
          // Apply initial filtering (limit connections to reduce initial complexity)
          const { nodes: filteredNodes, edges: filteredEdges } = filterGraph(rawNodes, rawEdges, graphFilter, maxConnections, showOnlyDirectDeps);
          setNodes(filteredNodes);
          setEdges(filteredEdges);
        }

        setActiveTab("Dashboard");
      } else {
        alert("Error: " + data.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !analysisData) return;

    const userMessage = chatMessage;
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: analysisData // Send full analysis data including codeChunks
        })
      });
      const data = await res.json();

      if (data.success) {
        setChatHistory(prev => [...prev, { role: 'ai', content: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', content: "Error: " + data.error }]);
      }
    } catch (error: any) {
      setChatHistory(prev => [...prev, { role: 'ai', content: "Error: " + error.message }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-[240px_1fr] bg-[#0A0A0A] text-slate-300 selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="flex flex-col border-r border-white/5 bg-black/20 p-4">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400">
            <Sparkles size={14} />
          </div>
          <span className="text-sm font-medium tracking-wide text-slate-200">PROMETHEUS</span>
        </div>

        <button
          onClick={() => { setAnalysisData(null); setActiveTab("Dashboard"); }}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
        >
          <span className="text-lg leading-none">+</span> Import Repository
        </button>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 ${activeTab === label
                ? "bg-cyan-500/10 text-cyan-400 font-medium"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
            >
              <Icon size={16} className={activeTab === label ? "text-cyan-400" : "text-slate-500"} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-8 rounded-md border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-500">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-slate-300">Command Palette</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
          </div>
          <p className="leading-relaxed">Search functions, open graphs, or ask AI.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/5 px-8 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Stripe Clone</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-medium text-slate-200">{activeTab}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500/80"></div>
              Analysis Complete
            </div>
            <span className="text-slate-700">|</span>
            <span>Last updated: 2m ago</span>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-5xl">
            {activeTab === "Dashboard" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-8">Repository Overview</h1>

                {!analysisData ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 max-w-xl">
                    <h2 className="text-lg font-medium text-slate-200 mb-2">Import Repository</h2>
                    <p className="text-sm text-slate-400 mb-6">Enter a GitHub URL or the absolute path to a local codebase to begin analysis.</p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1.5 block">Repository URL / Path</label>
                        <input
                          type="text"
                          value={repoPathInput}
                          onChange={(e) => setRepoPathInput(e.target.value)}
                          placeholder="e.g. https://github.com/lucide-icons/lucide or C:\path"
                          className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                        />
                      </div>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !repoPathInput}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAnalyzing ? (
                          <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                        ) : (
                          <><Sparkles size={16} /> Analyze Repository</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-6 gap-4 mb-12">
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Files</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.files}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Functions</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.functions}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Classes</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.classes}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Dependencies</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.dependencies}</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Resolved</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.resolvedImports}</span>
                        <span className="text-xs text-slate-500">{Math.round((analysisData.metrics.resolvedImports / Math.max(analysisData.metrics.dependencies, 1)) * 100)}%</span>
                      </div>
                      <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5">
                        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Calls</span>
                        <span className="text-3xl font-light text-slate-200">{analysisData.metrics.functionCalls || 0}</span>
                      </div>
                    </div>

                    <h2 className="text-lg font-medium text-slate-200 mb-4">Recent Activity</h2>
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-slate-400">
                      <p>Repository imported and analyzed successfully from <code className="bg-white/10 px-1 py-0.5 rounded">{repoPathInput}</code>.</p>
                      <p className="mt-2 text-xs text-slate-500">Extracted {analysisData.metrics.files} files and identified {analysisData.metrics.functions} functions.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "File Explorer" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[600px] flex">
                <div className="w-80 border-r border-white/5 pr-4 mr-6 overflow-y-auto">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">Files</h3>
                  <div className="space-y-1 text-sm text-slate-400">
                    {!analysisData ? (
                      <p className="text-xs italic text-slate-600">Import a repository first.</p>
                    ) : (
                      analysisData.files.map((file: any) => (
                        <div key={file.path} className="cursor-pointer hover:text-white px-3 py-2 rounded hover:bg-white/5 border border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-slate-300 truncate">{file.path}</span>
                            <div className="flex gap-2 text-xs">
                              <span className={`px-1.5 py-0.5 rounded ${
                                file.complexity > 20 ? 'bg-red-500/20 text-red-400' : 
                                file.complexity > 10 ? 'bg-amber-500/20 text-amber-400' : 
                                'bg-green-500/20 text-green-400'
                              }`}>
                                C{file.complexity || 0}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{file.functions?.length || 0} functions</span>
                            <span>{file.classes?.length || 0} classes</span>
                            <span>{file.imports?.length || 0} imports</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex-1 rounded-xl border border-white/5 bg-[#050505] p-6 font-mono text-sm overflow-y-auto">
                  {!analysisData ? (
                    <div className="text-slate-600 flex items-center justify-center h-full">Select a file to view details</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="text-slate-500 border-b border-white/5 pb-2">Enhanced Analysis Overview</div>
                      {analysisData.files[0] && (
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-cyan-400 mb-3 flex items-center gap-2">
                              Functions <span className="text-xs bg-cyan-500/20 px-2 py-1 rounded">{analysisData.files[0].functions?.length || 0}</span>
                            </h4>
                            <div className="space-y-2">
                              {(analysisData.files[0].functions || []).slice(0, 8).map((f: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-white/[0.02] px-3 py-2 rounded border border-white/5">
                                  <div>
                                    <span className="text-slate-200">{f.name || f}</span>
                                    {f.parameters && (
                                      <span className="text-xs text-slate-500 ml-2">({f.parameters.join(', ')})</span>
                                    )}
                                  </div>
                                  <div className="flex gap-2 text-xs">
                                    {f.complexity && (
                                      <span className={`px-1.5 py-0.5 rounded ${
                                        f.complexity > 10 ? 'bg-red-500/20 text-red-400' : 
                                        f.complexity > 5 ? 'bg-amber-500/20 text-amber-400' : 
                                        'bg-green-500/20 text-green-400'
                                      }`}>
                                        C{f.complexity}
                                      </span>
                                    )}
                                    {f.startLine && (
                                      <span className="text-slate-500">L{f.startLine}-{f.endLine}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-emerald-400 mb-3 flex items-center gap-2">
                              Imports <span className="text-xs bg-emerald-500/20 px-2 py-1 rounded">{analysisData.files[0].imports?.length || 0}</span>
                            </h4>
                            <div className="space-y-2">
                              {(analysisData.files[0].imports || []).slice(0, 6).map((imp: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-white/[0.02] px-3 py-2 rounded border border-white/5">
                                  <span className="text-slate-300 font-mono text-xs">{imp.original || imp}</span>
                                  <div className="flex gap-2">
                                    {imp.isResolved && (
                                      <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">✓</span>
                                    )}
                                    {imp.isExternal && (
                                      <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">EXT</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {analysisData.files[0].exports?.length > 0 && (
                            <div>
                              <h4 className="text-purple-400 mb-3">Exports</h4>
                              <div className="flex flex-wrap gap-2">
                                {analysisData.files[0].exports.map((exp: string, i: number) => (
                                  <span key={i} className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs">{exp}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Architecture" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-2">Architecture Overview</h1>
                <p className="text-sm text-slate-500 mb-8">Automatically detected architecture patterns and structure.</p>

                {!analysisData ? (
                  <div className="flex items-center justify-center p-12 rounded-xl border border-white/5 bg-[#050505] text-slate-600">
                    Import a repository to analyze its architecture.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Architecture Pattern */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-medium text-white">Detected Pattern</h2>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            analysisData.architecture?.pattern.confidence > 0.8 ? 'bg-green-500' :
                            analysisData.architecture?.pattern.confidence > 0.6 ? 'bg-yellow-500' : 'bg-gray-500'
                          }`}></div>
                          <span className="text-xs text-slate-500">
                            {Math.round((analysisData.architecture?.pattern.confidence || 0) * 100)}% confidence
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl font-light text-cyan-400">
                            {analysisData.architecture?.pattern.type || 'Unknown'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mb-4">
                          {analysisData.architecture?.pattern.description || 'No description available'}
                        </p>
                        
                        {analysisData.architecture?.pattern.characteristics && (
                          <div className="flex flex-wrap gap-2">
                            {analysisData.architecture.pattern.characteristics.map((char: string, i: number) => (
                              <span key={i} className="px-2 py-1 bg-cyan-500/10 text-cyan-300 text-xs rounded border border-cyan-500/20">
                                {char}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Layers */}
                    {analysisData.architecture?.layers && analysisData.architecture.layers.length > 0 && (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <h2 className="text-lg font-medium text-white mb-4">Architecture Layers</h2>
                        <div className="space-y-4">
                          {analysisData.architecture.layers.map((layer: any, i: number) => (
                            <div key={i} className="border border-white/5 rounded-lg p-4 bg-white/[0.01]">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-slate-200">{layer.name}</h3>
                                <span className="text-xs text-slate-500">{layer.files.length} files</span>
                              </div>
                              <p className="text-xs text-slate-400 mb-3">{layer.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {layer.files.slice(0, 6).map((file: string, j: number) => (
                                  <span key={j} className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded font-mono">
                                    {file.split('/').pop()}
                                  </span>
                                ))}
                                {layer.files.length > 6 && (
                                  <span className="px-2 py-1 text-slate-500 text-xs">
                                    +{layer.files.length - 6} more
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Components */}
                    {analysisData.architecture?.components && analysisData.architecture.components.length > 0 && (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <h2 className="text-lg font-medium text-white mb-4">Key Components</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {analysisData.architecture.components.slice(0, 6).map((comp: any, i: number) => (
                            <div key={i} className="border border-white/5 rounded-lg p-4 bg-white/[0.01]">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-slate-200">{comp.name}</h3>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 text-xs rounded ${
                                    comp.complexity === 'high' ? 'bg-red-500/20 text-red-400' :
                                    comp.complexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                  }`}>
                                    {comp.complexity}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 mb-2 capitalize">{comp.type.replace('-', ' ')}</div>
                              <div className="flex flex-wrap gap-1">
                                {comp.responsibilities?.slice(0, 3).map((resp: string, j: number) => (
                                  <span key={j} className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded">
                                    {resp}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Insights */}
                    {analysisData.architecture?.insights && analysisData.architecture.insights.length > 0 && (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
                        <h2 className="text-lg font-medium text-white mb-4">Architecture Insights</h2>
                        <div className="space-y-3">
                          {analysisData.architecture.insights.map((insight: any, i: number) => (
                            <div key={i} className={`border rounded-lg p-4 ${
                              insight.type === 'strength' ? 'border-green-500/20 bg-green-500/5' :
                              insight.type === 'risk' ? 'border-red-500/20 bg-red-500/5' :
                              insight.type === 'suggestion' ? 'border-blue-500/20 bg-blue-500/5' :
                              'border-yellow-500/20 bg-yellow-500/5'
                            }`}>
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                  insight.type === 'strength' ? 'bg-green-400' :
                                  insight.type === 'risk' ? 'bg-red-400' :
                                  insight.type === 'suggestion' ? 'bg-blue-400' :
                                  'bg-yellow-400'
                                }`}></div>
                                <div className="flex-1">
                                  <h3 className={`font-medium text-sm mb-1 ${
                                    insight.type === 'strength' ? 'text-green-300' :
                                    insight.type === 'risk' ? 'text-red-300' :
                                    insight.type === 'suggestion' ? 'text-blue-300' :
                                    'text-yellow-300'
                                  }`}>
                                    {insight.title}
                                  </h3>
                                  <p className="text-xs text-slate-400">{insight.description}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "Graph Explorer" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[600px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-light tracking-tight text-white mb-2">Dependency Graph</h1>
                    <p className="text-sm text-slate-500">Interactive visualization of module imports and calls.</p>
                  </div>
                  
                  {/* Graph Controls */}
                  {analysisData && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400">Filter:</label>
                        <input
                          type="text"
                          value={graphFilter}
                          onChange={(e) => setGraphFilter(e.target.value)}
                          placeholder="Search nodes..."
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs w-32 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-slate-400">Max connections:</label>
                        <select
                          value={maxConnections}
                          onChange={(e) => setMaxConnections(Number(e.target.value))}
                          className="px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value={0}>All</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          setGraphFilter('');
                          setMaxConnections(3);
                          setShowOnlyDirectDeps(true);
                        }}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 rounded-xl border border-white/5 bg-[#050505] relative overflow-hidden">
                  {!analysisData ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                      Import a repository to view the graph.
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '100%' }}>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        fitView
                        colorMode="dark"
                        maxZoom={2}
                        minZoom={0.1}
                      >
                        <Controls style={{ padding: '4px', backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        <MiniMap
                          nodeColor="#334155"
                          maskColor="rgb(15, 23, 42, 0.7)"
                          style={{ backgroundColor: '#020617', border: '1px solid #1e293b' }}
                        />
                        <Background color="#334155" gap={24} size={1} />
                      </ReactFlow>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "AI Chat" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 h-[600px] flex flex-col">
                <h1 className="text-2xl font-light tracking-tight text-white mb-6">Ask Prometheus</h1>

                <div className="flex-1 rounded-xl border border-white/5 bg-[#050505] p-6 mb-4 overflow-y-auto space-y-6">
                  {!analysisData ? (
                    <div className="flex h-full items-center justify-center text-slate-600">
                      Import a repository first to begin chatting about it.
                    </div>
                  ) : chatHistory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-500 text-center px-12">
                      <p>I'm Prometheus. I've analyzed your {analysisData.metrics.files} files. What would you like to know about this repository?</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                          {msg.role === 'user' ? 'U' : <Sparkles size={16} />}
                        </div>
                        <div>
                          {msg.role === 'user' ? (
                            <p className="text-sm text-slate-200 mt-1">{msg.content}</p>
                          ) : (
                            <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {isChatLoading && (
                    <div className="flex gap-4">
                      <div className="h-8 w-8 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <Loader2 size={16} className="animate-spin" />
                      </div>
                      <div className="text-sm text-slate-500 mt-1 animate-pulse">Thinking...</div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleChatSubmit} className="relative">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={!analysisData || isChatLoading}
                    placeholder={analysisData ? "Ask about your codebase..." : "Import repository first..."}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg py-4 pl-4 pr-12 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!analysisData || isChatLoading || !chatMessage.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Sparkles size={16} />
                  </button>
                </form>
              </div>
            )}

            {activeTab === "Impact Analyzer" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-2">Impact Analyzer</h1>
                <p className="text-sm text-slate-500 mb-8">See what breaks downstream when you change a function.</p>

                <div className="rounded-xl border border-white/5 bg-[#050505] p-6">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <SearchCode className="text-amber-400" size={20} />
                    <span className="text-sm font-medium text-slate-200">Analyzing changes to <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-300 mx-1">processPayment()</code></span>
                  </div>

                  <div className="space-y-4 text-sm">
                    <p className="text-slate-400">The following modules will be affected:</p>
                    <div className="grid grid-cols-2 gap-4">
                      {["checkoutService", "refundService", "billingAPI", "subscriptionWorker"].map(module => (
                        <div key={module} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                          <span className="font-mono text-slate-300">{module}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Settings" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <h1 className="text-2xl font-light tracking-tight text-white mb-6">Settings</h1>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-sm text-slate-400">
                  Configuration options will appear here.
                </div>
              </div>
            )}

          </div>
        </div>
      </section>
    </main>
  );
}
