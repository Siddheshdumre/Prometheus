"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from "lucide-react";

export interface FileNode {
    path: string;
    functions: Array<{
        name: string;
        startLine: number;
        endLine: number;
        complexity: number;
        parameters: string[];
        isExported: boolean;
    }>;
    classes: string[];
    imports: Array<{
        original: string;
        resolved: string | null;
        isExternal: boolean;
        isResolved: boolean;
        importedMembers: string[];
    }>;
    exports: string[];
    complexity: number;
    size: number;
}

interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: TreeNode[];
    fileData?: FileNode;
}

interface FileTreeProps {
    files: FileNode[];
    selectedFile: string | null;
    onFileSelect: (file: FileNode) => void;
}

export function FileTree({ files, selectedFile, onFileSelect }: FileTreeProps) {
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));

    // Build tree structure from flat file list
    const fileTree = useMemo(() => {
        const root: TreeNode = {
            name: 'root',
            path: '',
            type: 'directory',
            children: []
        };

        files.forEach(file => {
            const parts = file.path.split('/').filter(Boolean);
            let current = root;

            // Traverse/create directory structure
            for (let i = 0; i < parts.length - 1; i++) {
                const dirName = parts[i];
                const dirPath = parts.slice(0, i + 1).join('/');
                
                let existingDir = current.children?.find(
                    child => child.name === dirName && child.type === 'directory'
                );

                if (!existingDir) {
                    existingDir = {
                        name: dirName,
                        path: dirPath,
                        type: 'directory',
                        children: []
                    };
                    if (!current.children) current.children = [];
                    current.children.push(existingDir);
                }
                current = existingDir;
            }

            // Add the file
            const fileName = parts[parts.length - 1];
            if (!current.children) current.children = [];
            current.children.push({
                name: fileName,
                path: file.path,
                type: 'file',
                fileData: file
            });
        });

        // Sort children (directories first, then files, both alphabetically)
        const sortChildren = (node: TreeNode) => {
            if (node.children) {
                node.children.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });
                node.children.forEach(sortChildren);
            }
        };
        sortChildren(root);

        return root.children || [];
    }, [files]);

    const toggleDirectory = (dirPath: string) => {
        setExpandedDirs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dirPath)) {
                newSet.delete(dirPath);
            } else {
                newSet.add(dirPath);
            }
            return newSet;
        });
    };

    const renderTreeNode = (node: TreeNode, level: number = 0) => {
        const isDirectory = node.type === 'directory';
        const isExpanded = expandedDirs.has(node.path);
        const isSelected = selectedFile === node.path && !isDirectory;
        
        const paddingLeft = level * 16 + 8;

        return (
            <div key={node.path} className="select-none">
                <div
                    className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors ${
                        isSelected 
                            ? 'bg-cyan-500/20 text-cyan-300 border-l-2 border-cyan-400' 
                            : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                    style={{ paddingLeft }}
                    onClick={() => {
                        if (isDirectory) {
                            toggleDirectory(node.path);
                        } else if (node.fileData) {
                            onFileSelect(node.fileData);
                        }
                    }}
                >
                    {isDirectory ? (
                        <>
                            {isExpanded ? (
                                <ChevronDown size={14} className="text-slate-500" />
                            ) : (
                                <ChevronRight size={14} className="text-slate-500" />
                            )}
                            {isExpanded ? (
                                <FolderOpen size={14} className="text-blue-400" />
                            ) : (
                                <Folder size={14} className="text-blue-400" />
                            )}
                        </>
                    ) : (
                        <>
                            <div className="w-[14px]" /> {/* Spacer for alignment */}
                            <FileText size={14} className="text-green-400" />
                        </>
                    )}
                    
                    <span className="text-xs font-mono flex-1 truncate">{node.name}</span>
                    
                    {!isDirectory && node.fileData && (
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-500">
                                {node.fileData.functions?.length || 0}f
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                node.fileData.complexity > 20 ? 'bg-red-500/20 text-red-400' :
                                node.fileData.complexity > 10 ? 'bg-amber-500/20 text-amber-400' :
                                'bg-green-500/20 text-green-400'
                            }`}>
                                C{node.fileData.complexity || 0}
                            </span>
                        </div>
                    )}
                </div>
                
                {isDirectory && isExpanded && node.children && (
                    <div>
                        {node.children.map(child => renderTreeNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="text-sm text-slate-400 overflow-y-auto">
            <div className="p-3 border-b border-white/5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
                    Files ({files.length})
                </h3>
            </div>
            <div className="p-2">
                {fileTree.map(node => renderTreeNode(node, 0))}
            </div>
        </div>
    );
}