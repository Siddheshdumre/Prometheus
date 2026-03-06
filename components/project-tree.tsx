"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode, FileText, FileJson, FileType, Search } from "lucide-react";

interface FileNode {
  path: string;
  functions: { name: string; isExported: boolean; complexity: number }[];
  classes: string[];
  imports: { original: string; isExternal: boolean }[];
  exports: string[];
  complexity: number;
  size: number;
}

interface ArchitectureLayer {
  name: string;
  type: string;
  files: string[];
  description: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: TreeNode[];
  file?: FileNode;
  annotation?: string;
}

const FILE_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  ts: { icon: FileCode, color: "text-blue-400" },
  tsx: { icon: FileCode, color: "text-cyan-400" },
  js: { icon: FileCode, color: "text-yellow-400" },
  jsx: { icon: FileCode, color: "text-yellow-300" },
  json: { icon: FileJson, color: "text-green-400" },
  md: { icon: FileText, color: "text-slate-400" },
  css: { icon: FileType, color: "text-purple-400" },
  scss: { icon: FileType, color: "text-pink-400" },
  py: { icon: FileCode, color: "text-green-400" },
  java: { icon: FileCode, color: "text-orange-400" },
  go: { icon: FileCode, color: "text-cyan-300" },
  rs: { icon: FileCode, color: "text-orange-300" },
  rb: { icon: FileCode, color: "text-red-400" },
};

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICON_MAP[ext] || { icon: FileText, color: "text-slate-500" };
}

function generateAnnotation(file: FileNode | undefined, dirFiles: FileNode[]): string {
  if (file) {
    const parts: string[] = [];
    if (file.functions.length > 0) {
      const exported = file.functions.filter(f => f.isExported);
      if (exported.length > 0) {
        parts.push(`${exported.length} exported fn${exported.length > 1 ? "s" : ""}`);
      } else {
        parts.push(`${file.functions.length} fn${file.functions.length > 1 ? "s" : ""}`);
      }
    }
    if (file.classes.length > 0) {
      parts.push(`${file.classes.length} class${file.classes.length > 1 ? "es" : ""}`);
    }
    if (file.complexity > 10) {
      parts.push(`complexity ${file.complexity}`);
    }
    if (file.size > 0) {
      parts.push(`${file.size} lines`);
    }
    return parts.join(", ");
  }

  // Directory annotation
  if (dirFiles.length > 0) {
    return `${dirFiles.length} file${dirFiles.length > 1 ? "s" : ""}`;
  }
  return "";
}

function buildTree(files: FileNode[], layers: ArchitectureLayer[]): TreeNode {
  const root: TreeNode = { name: "", fullPath: "", isDir: true, children: [] };

  // Find common prefix to strip
  const paths = files.map(f => f.path);
  let prefix = "";
  if (paths.length > 0) {
    const parts = paths[0].split("/");
    for (let i = 0; i < parts.length; i++) {
      const candidate = parts.slice(0, i + 1).join("/") + "/";
      if (paths.every(p => p.startsWith(candidate))) {
        prefix = candidate;
      } else break;
    }
  }

  // Map layer files for directory annotations
  const layerMap = new Map<string, string>();
  for (const layer of layers) {
    for (const f of layer.files) {
      const rel = f.startsWith(prefix) ? f.slice(prefix.length) : f;
      const dir = rel.split("/").slice(0, -1).join("/");
      if (dir && !layerMap.has(dir)) {
        layerMap.set(dir, `${layer.name} — ${layer.description}`);
      }
    }
  }

  for (const file of files) {
    const rel = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
    const segments = rel.split("/");
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isFile = i === segments.length - 1;
      const fullPath = segments.slice(0, i + 1).join("/");

      let existing = current.children.find(c => c.name === seg);
      if (!existing) {
        existing = {
          name: seg,
          fullPath,
          isDir: !isFile,
          children: [],
          file: isFile ? file : undefined,
          annotation: isFile ? undefined : layerMap.get(fullPath),
        };
        current.children.push(existing);
      }
      if (isFile) {
        existing.file = file;
      }
      current = existing;
    }
  }

  // Sort: directories first, then alphabetically
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  };
  sortChildren(root);

  // Generate annotations for directories that don't have one from layers
  const annotateDir = (node: TreeNode): FileNode[] => {
    if (!node.isDir) return node.file ? [node.file] : [];
    const allFiles: FileNode[] = [];
    for (const child of node.children) {
      allFiles.push(...annotateDir(child));
    }
    if (!node.annotation && allFiles.length > 0) {
      node.annotation = generateAnnotation(undefined, allFiles);
    }
    return allFiles;
  };
  for (const child of root.children) {
    annotateDir(child);
  }

  // Generate file annotations
  const annotateFiles = (node: TreeNode) => {
    if (!node.isDir && node.file && !node.annotation) {
      node.annotation = generateAnnotation(node.file, []);
    }
    node.children.forEach(annotateFiles);
  };
  root.children.forEach(annotateFiles);

  return root;
}

function TreeRow({ node, depth, expandedPaths, toggleExpand, filter }: {
  node: TreeNode;
  depth: number;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  filter: string;
}) {
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.isDir && node.children.length > 0;
  const { icon: FileIcon, color: iconColor } = getFileIcon(node.name);

  const matchesFilter = !filter || node.name.toLowerCase().includes(filter.toLowerCase()) ||
    (node.annotation || "").toLowerCase().includes(filter.toLowerCase());
  
  const hasMatchingDescendant = (n: TreeNode): boolean => {
    if (n.name.toLowerCase().includes(filter.toLowerCase())) return true;
    if ((n.annotation || "").toLowerCase().includes(filter.toLowerCase())) return true;
    return n.children.some(hasMatchingDescendant);
  };

  const shouldShow = !filter || matchesFilter || hasMatchingDescendant(node);
  if (!shouldShow) return null;

  return (
    <>
      <div
        className="group flex items-start gap-1 py-[3px] hover:bg-white/[0.03] cursor-pointer rounded-sm transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && toggleExpand(node.fullPath)}
      >
        {/* Expand/collapse icon */}
        <span className="w-4 h-5 flex items-center justify-center shrink-0 text-slate-600">
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="w-[14px]" />
          )}
        </span>

        {/* File/folder icon */}
        <span className={`shrink-0 mt-[2px] ${node.isDir ? "text-amber-400/80" : iconColor}`}>
          {node.isDir ? (
            isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />
          ) : (
            <FileIcon size={14} />
          )}
        </span>

        {/* Name */}
        <span className={`text-[13px] leading-5 ml-1.5 ${node.isDir ? "text-slate-200 font-medium" : "text-slate-400"}`}>
          {node.name}{node.isDir ? "/" : ""}
        </span>

        {/* Annotation */}
        {node.annotation && (
          <span className="text-[12px] leading-5 text-slate-600 ml-4 whitespace-nowrap overflow-hidden text-ellipsis">
            # {node.annotation}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && node.children.map(child => (
        <TreeRow
          key={child.fullPath}
          node={child}
          depth={depth + 1}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          filter={filter}
        />
      ))}
    </>
  );
}

export function ProjectTree({ analysisData }: { analysisData: any }) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [initialized, setInitialized] = useState(false);

  const tree = useMemo(() => {
    if (!analysisData?.files) return null;
    const layers = analysisData.architecture?.layers || [];
    return buildTree(analysisData.files, layers);
  }, [analysisData]);

  // Auto-expand first 2 levels on first render
  useMemo(() => {
    if (tree && !initialized) {
      const paths = new Set<string>();
      const expandLevel = (node: TreeNode, depth: number) => {
        if (depth > 2) return;
        if (node.isDir) {
          paths.add(node.fullPath);
          node.children.forEach(c => expandLevel(c, depth + 1));
        }
      };
      tree.children.forEach(c => expandLevel(c, 0));
      setExpandedPaths(paths);
      setInitialized(true);
    }
  }, [tree, initialized]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    if (!tree) return;
    const all = new Set<string>();
    const walk = (node: TreeNode) => {
      if (node.isDir) {
        all.add(node.fullPath);
        node.children.forEach(walk);
      }
    };
    tree.children.forEach(walk);
    setExpandedPaths(all);
  };

  const collapseAll = () => setExpandedPaths(new Set());

  if (!analysisData) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        Import a repository to view the project structure.
      </div>
    );
  }

  if (!tree) return null;

  // Stats
  const totalFiles = analysisData.files?.length || 0;
  const totalDirs = new Set(
    (analysisData.files || []).map((f: FileNode) => {
      const parts = f.path.split("/");
      return parts.slice(0, -1).join("/");
    }).filter(Boolean)
  ).size;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="flex items-center gap-2 flex-1 relative">
          <Search size={14} className="absolute left-2.5 text-slate-500" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter files and folders..."
            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500/50 placeholder:text-slate-600"
          />
        </div>
        <button onClick={expandAll} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap">
          Expand all
        </button>
        <button onClick={collapseAll} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap">
          Collapse all
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-3 py-2 mb-2 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-slate-500">
        <span>{totalDirs} directories</span>
        <span className="text-slate-700">·</span>
        <span>{totalFiles} files</span>
        <span className="text-slate-700">·</span>
        <span>{analysisData.metrics?.functions || 0} functions</span>
        <span className="text-slate-700">·</span>
        <span>{analysisData.metrics?.classes || 0} classes</span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/5 bg-[#050505] font-mono">
        <div className="p-3">
          {tree.children.map(child => (
            <TreeRow
              key={child.fullPath}
              node={child}
              depth={0}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              filter={filter}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
