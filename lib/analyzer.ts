import { Project, Node, SourceFile, SyntaxKind } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

export interface AnalysisResult {
    metrics: {
        files: number;
        functions: number;
        classes: number;
        dependencies: number;
        resolvedImports: number;
        functionCalls: number;
    };
    files: FileNode[];
    graph: {
        nodes: GraphNode[];
        edges: GraphEdge[];
    };
    functionCalls: FunctionCall[];
    codeChunks: CodeChunk[];
    architecture: ArchitectureAnalysis;
}

export interface ArchitectureAnalysis {
    pattern: ArchitecturePattern;
    layers: ArchitectureLayer[];
    components: ArchitectureComponent[];
    dataFlow: DataFlowConnection[];
    insights: ArchitectureInsight[];
}

export interface ArchitecturePattern {
    type: 'Next.js App' | 'React SPA' | 'Node.js API' | 'Component-Service' | 'Layered' | 'Micro-Frontend' | 'Custom';
    confidence: number;
    description: string;
    characteristics: string[];
}

export interface ArchitectureLayer {
    name: string;
    type: 'presentation' | 'business' | 'data' | 'infrastructure' | 'api';
    files: string[];
    description: string;
    dependencies: string[];
}

export interface ArchitectureComponent {
    name: string;
    type: 'page' | 'component' | 'service' | 'utility' | 'config' | 'api-route';
    files: string[];
    responsibilities: string[];
    complexity: 'low' | 'medium' | 'high';
    connections: number;
}

export interface DataFlowConnection {
    from: string;
    to: string;
    type: 'data' | 'control' | 'event';
    description: string;
}

export interface ArchitectureInsight {
    type: 'strength' | 'weakness' | 'suggestion' | 'risk';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    affectedFiles?: string[];
}

export interface FileNode {
    path: string;
    functions: FunctionInfo[];
    classes: string[];
    imports: ResolvedImport[];
    exports: string[];
    complexity: number;
    size: number;
}

export interface FunctionInfo {
    name: string;
    startLine: number;
    endLine: number;
    complexity: number;
    parameters: string[];
    isExported: boolean;
}

export interface ResolvedImport {
    original: string;
    resolved: string | null;
    isExternal: boolean;
    isResolved: boolean;
    importedMembers: string[];
}

export interface FunctionCall {
    caller: string;
    callerFile: string;
    target: string;
    targetFile: string | null;
    lineNumber: number;
}

export interface CodeChunk {
    id: string;
    filePath: string;
    functionName?: string;
    content: string;
    lineStart: number;
    lineEnd: number;
    type: 'file' | 'function' | 'class';
}

export interface GraphNode {
    id: string;
    label: string;
    type: 'file' | 'function' | 'external';
    group?: string;
    complexity?: number;
    size?: number;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: 'imports' | 'calls';
    weight: number;
}

class ImportResolver {
    constructor(private repoPath: string, private sourceFiles: SourceFile[]) {}

    resolveImportPath(importPath: string, currentFilePath: string): string | null {
        // Handle relative imports
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const currentDir = path.dirname(currentFilePath);
            const resolvedPath = path.resolve(currentDir, importPath);
            
            // Try different extensions
            const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
            
            for (const ext of extensions) {
                const testPath = resolvedPath + ext;
                const relativePath = path.relative(this.repoPath, testPath).replace(/\\/g, '/');
                
                // Check if this file exists in our source files
                if (this.sourceFiles.some(sf => {
                    const sfPath = sf.getFilePath().replace(/\\/g, '/');
                    const sfRelative = path.relative(this.repoPath, sfPath).replace(/\\/g, '/');
                    return sfRelative === relativePath;
                })) {
                    return relativePath;
                }
            }
        }
        
        // For absolute/external imports, we can't resolve them locally
        return null;
    }

    resolveAllImports(sourceFile: SourceFile): ResolvedImport[] {
        const imports = sourceFile.getImportDeclarations();
        const currentFilePath = sourceFile.getFilePath();
        
        return imports.map(importDecl => {
            const original = importDecl.getModuleSpecifierValue();
            const resolved = this.resolveImportPath(original, currentFilePath);
            const isExternal = !original.startsWith('./') && !original.startsWith('../');
            const importedMembers = importDecl.getNamedImports().map(ni => ni.getName());
            
            return {
                original,
                resolved,
                isExternal,
                isResolved: resolved !== null,
                importedMembers
            };
        });
    }
}

class FunctionAnalyzer {
    analyzeFunctions(sourceFile: SourceFile, filePath: string): FunctionInfo[] {
        const functions: FunctionInfo[] = [];
        
        // Regular functions
        sourceFile.getFunctions().forEach(func => {
            functions.push({
                name: func.getName() || 'anonymous',
                startLine: func.getStartLineNumber(),
                endLine: func.getEndLineNumber(),
                complexity: this.calculateComplexity(func),
                parameters: func.getParameters().map(p => p.getName()),
                isExported: func.isExported()
            });
        });
        
        // Arrow functions and function expressions
        sourceFile.getVariableDeclarations().forEach(varDecl => {
            const initializer = varDecl.getInitializer();
            if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
                functions.push({
                    name: varDecl.getName(),
                    startLine: varDecl.getStartLineNumber(),
                    endLine: varDecl.getEndLineNumber(), 
                    complexity: this.calculateComplexity(initializer),
                    parameters: initializer.getParameters().map(p => p.getName()),
                    isExported: varDecl.isExported()
                });
            }
        });
        
        // Method functions in classes
        sourceFile.getClasses().forEach(cls => {
            cls.getMethods().forEach(method => {
                functions.push({
                    name: `${cls.getName()}.${method.getName()}`,
                    startLine: method.getStartLineNumber(),
                    endLine: method.getEndLineNumber(),
                    complexity: this.calculateComplexity(method),
                    parameters: method.getParameters().map(p => p.getName()),
                    isExported: cls.isExported()
                });
            });
        });
        
        return functions;
    }
    
    private calculateComplexity(node: any): number {
        // Simple cyclomatic complexity approximation
        const text = node.getText();
        const patterns = [/if\s*\(/g, /else/g, /while\s*\(/g, /for\s*\(/g, /case\s+/g, /catch\s*\(/g, /&&/g, /\|\|/g];
        let complexity = 1; // Base complexity
        
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) complexity += matches.length;
        });
        
        return complexity;
    }
}

class ArchitectureDetector {
    private files: FileNode[];
    private repoPath: string;

    constructor(files: FileNode[], repoPath: string) {
        this.files = files;
        this.repoPath = repoPath;
    }

    detectArchitecture(): ArchitectureAnalysis {
        const pattern = this.detectArchitecturePattern();
        const layers = this.detectLayers();
        const components = this.detectComponents();
        const dataFlow = this.detectDataFlow();
        const insights = this.generateInsights(pattern, layers, components);

        return {
            pattern,
            layers,
            components,
            dataFlow,
            insights
        };
    }

    private detectArchitecturePattern(): ArchitecturePattern {
        const filePaths = this.files.map(f => f.path);
        
        // Check for Next.js App Router pattern
        if (filePaths.some(p => p.includes('app/') && p.endsWith('page.tsx')) ||
            filePaths.some(p => p.includes('next.config'))) {
            return {
                type: 'Next.js App',
                confidence: 0.9,
                description: 'Next.js application with App Router structure',
                characteristics: [
                    'App directory structure',
                    'Page-based routing',
                    'API routes',
                    'Server and client components'
                ]
            };
        }

        // Check for React SPA pattern
        if (filePaths.some(p => p.includes('src/') && p.includes('component')) ||
            filePaths.some(p => p.includes('public/index.html'))) {
            return {
                type: 'React SPA', 
                confidence: 0.8,
                description: 'Single Page Application with React',
                characteristics: [
                    'Component-based architecture',
                    'Client-side routing',
                    'Bundled assets'
                ]
            };
        }

        // Check for Node.js API pattern
        if (filePaths.some(p => p.includes('routes/') || p.includes('controllers/')) &&
            filePaths.some(p => p.includes('server') || p.includes('app.js'))) {
            return {
                type: 'Node.js API',
                confidence: 0.85,
                description: 'Node.js REST API server',
                characteristics: [
                    'Route handlers',
                    'Middleware',
                    'Database models',
                    'API endpoints'
                ]
            };
        }

        return {
            type: 'Custom',
            confidence: 0.5,
            description: 'Custom application architecture',
            characteristics: ['Mixed patterns', 'Custom structure']
        };
    }

    private detectLayers(): ArchitectureLayer[] {
        const layers: ArchitectureLayer[] = [];
        const filePaths = this.files.map(f => f.path);

        // Presentation layer
        const presentationFiles = this.files.filter(f => 
            f.path.includes('component') || 
            f.path.includes('page') || 
            f.path.includes('ui/') ||
            f.path.endsWith('.tsx') && f.functions.some(fn => fn.name.includes('Component') || fn.name[0] === fn.name[0].toUpperCase())
        );

        if (presentationFiles.length > 0) {
            layers.push({
                name: 'Presentation Layer',
                type: 'presentation',
                files: presentationFiles.map(f => f.path),
                description: 'UI components, pages, and user interface logic',
                dependencies: ['business']
            });
        }

        // Business/Logic layer
        const businessFiles = this.files.filter(f => 
            f.path.includes('lib/') || 
            f.path.includes('utils/') || 
            f.path.includes('services/') ||
            f.path.includes('hooks/') ||
            f.functions.some(fn => fn.name.includes('use') || fn.name.includes('Service'))
        );

        if (businessFiles.length > 0) {
            layers.push({
                name: 'Business Logic',
                type: 'business', 
                files: businessFiles.map(f => f.path),
                description: 'Core business logic, utilities, and services',
                dependencies: ['data']
            });
        }

        // API layer
        const apiFiles = this.files.filter(f => 
            f.path.includes('api/') || 
            f.path.includes('route') ||
            f.functions.some(fn => ['GET', 'POST', 'PUT', 'DELETE'].some(method => fn.name.includes(method)))
        );

        if (apiFiles.length > 0) {
            layers.push({
                name: 'API Layer',
                type: 'api',
                files: apiFiles.map(f => f.path),
                description: 'API routes, endpoints, and server-side logic',
                dependencies: ['business']
            });
        }

        // Data layer
        const dataFiles = this.files.filter(f => 
            f.path.includes('model') || 
            f.path.includes('schema') || 
            f.path.includes('db/') ||
            f.functions.some(fn => fn.name.includes('Model') || fn.name.includes('Schema'))
        );

        if (dataFiles.length > 0) {
            layers.push({
                name: 'Data Layer',
                type: 'data',
                files: dataFiles.map(f => f.path),
                description: 'Data models, schemas, and database interactions',
                dependencies: []
            });
        }

        return layers;
    }

    private detectComponents(): ArchitectureComponent[] {
        const components: ArchitectureComponent[] = [];

        // Group files by directory to identify major components
        const componentsByDir = this.files.reduce((acc, file) => {
            const dir = path.dirname(file.path);
            if (!acc[dir]) acc[dir] = [];
            acc[dir].push(file);
            return acc;
        }, {} as Record<string, FileNode[]>);

        Object.entries(componentsByDir).forEach(([dir, files]) => {
            if (files.length === 0) return;

            const totalComplexity = files.reduce((sum, f) => sum + f.complexity, 0);
            const totalConnections = files.reduce((sum, f) => sum + f.imports.length + f.exports.length, 0);
            
            let type: ArchitectureComponent['type'] = 'utility';
            let responsibilities: string[] = [];

            if (dir.includes('page') || files.some(f => f.path.includes('page'))) {
                type = 'page';
                responsibilities = ['Routing', 'Page layout', 'Data fetching'];
            } else if (dir.includes('component') || files.some(f => f.functions.some(fn => fn.name.includes('Component')))) {
                type = 'component';
                responsibilities = ['UI rendering', 'User interaction', 'State management'];
            } else if (dir.includes('api') || files.some(f => f.path.includes('api'))) {
                type = 'api-route';
                responsibilities = ['Request handling', 'Data processing', 'Response formatting'];
            } else if (dir.includes('lib') || dir.includes('utils')) {
                type = 'utility';
                responsibilities = ['Helper functions', 'Common utilities', 'Shared logic'];
            } else if (dir.includes('service')) {
                type = 'service';
                responsibilities = ['External integrations', 'Business logic', 'Data processing'];
            }

            components.push({
                name: dir === '.' ? 'Root' : path.basename(dir),
                type,
                files: files.map(f => f.path),
                responsibilities,
                complexity: totalComplexity > 50 ? 'high' : totalComplexity > 15 ? 'medium' : 'low',
                connections: totalConnections
            });
        });

        return components.sort((a, b) => b.connections - a.connections);
    }

    private detectDataFlow(): DataFlowConnection[] {
        const connections: DataFlowConnection[] = [];

        // Analyze import relationships to understand data flow
        this.files.forEach(file => {
            file.imports.forEach(imp => {
                if (imp.isResolved && imp.resolved) {
                    connections.push({
                        from: imp.resolved,
                        to: file.path,
                        type: 'data',
                        description: `${file.path} imports from ${imp.resolved}`
                    });
                }
            });
        });

        return connections;
    }

    private generateInsights(pattern: ArchitecturePattern, layers: ArchitectureLayer[], components: ArchitectureComponent[]): ArchitectureInsight[] {
        const insights: ArchitectureInsight[] = [];

        // Pattern-specific insights
        if (pattern.type === 'Next.js App' && pattern.confidence > 0.8) {
            insights.push({
                type: 'strength',
                title: 'Modern Next.js Architecture',
                description: 'Using Next.js App Router for optimal performance and developer experience',
                severity: 'low'
            });
        }

        // Complexity insights
        const highComplexityComponents = components.filter(c => c.complexity === 'high');
        if (highComplexityComponents.length > 0) {
            insights.push({
                type: 'risk',
                title: 'High Complexity Components',
                description: `${highComplexityComponents.length} components have high complexity and may need refactoring`,
                severity: 'medium',
                affectedFiles: highComplexityComponents.flatMap(c => c.files)
            });
        }

        // Layer insights
        const presentationLayer = layers.find(l => l.type === 'presentation');
        const businessLayer = layers.find(l => l.type === 'business');
        
        if (presentationLayer && !businessLayer) {
            insights.push({
                type: 'suggestion',
                title: 'Consider Business Logic Separation',
                description: 'Extract business logic into separate service/utility files for better maintainability',
                severity: 'low'
            });
        }

        if (layers.length >= 3) {
            insights.push({
                type: 'strength',
                title: 'Good Separation of Concerns',
                description: 'Well-structured layered architecture with clear separation',
                severity: 'low'
            });
        }

        return insights;
    }
}

class CallAnalyzer {
    findFunctionCalls(sourceFiles: SourceFile[]): FunctionCall[] {
        const calls: FunctionCall[] = [];
        
        sourceFiles.forEach(sourceFile => {
            const filePath = this.getRelativePath(sourceFile);
            
            sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
                const expression = callExpr.getExpression();
                let functionName = '';
                let targetFile: string | null = null;
                
                if (Node.isIdentifier(expression)) {
                    functionName = expression.getText();
                } else if (Node.isPropertyAccessExpression(expression)) {
                    functionName = expression.getName();
                }
                
                if (functionName) {
                    calls.push({
                        caller: 'unknown',
                        callerFile: filePath,
                        target: functionName,
                        targetFile,
                        lineNumber: callExpr.getStartLineNumber()
                    });
                }
            });
        });
        
        return calls;
    }
    
    private getRelativePath(sourceFile: SourceFile): string {
        return sourceFile.getFilePath().replace(/\\/g, '/');
    }
}

export async function analyzeRepository(repoPath: string): Promise<AnalysisResult> {
    const project = new Project();
    const normalizedRepoPath = repoPath.replace(/\\/g, '/');

    // Add all typescript/javascript files
    project.addSourceFilesAtPaths([
        `${normalizedRepoPath}/**/*.{ts,tsx,js,jsx}`,
        `!${normalizedRepoPath}/**/node_modules/**`,
        `!${normalizedRepoPath}/**/.next/**`,
        `!${normalizedRepoPath}/**/.git/**`,
        `!${normalizedRepoPath}/**/dist/**`,
        `!${normalizedRepoPath}/**/build/**`
    ]);

    const sourceFiles = project.getSourceFiles();
    const importResolver = new ImportResolver(normalizedRepoPath, sourceFiles);
    const functionAnalyzer = new FunctionAnalyzer();
    const callAnalyzer = new CallAnalyzer();

    // Analyze all files
    const fileNodes: FileNode[] = [];
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];
    const codeChunks: CodeChunk[] = [];
    
    let totalFunctions = 0;
    let totalClasses = 0;
    let resolvedImports = 0;
    
    for (const sourceFile of sourceFiles) {
        let filePath = sourceFile.getFilePath().replace(normalizedRepoPath, '');
        if (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
        }
        filePath = filePath.replace(/\\/g, '/');

        // Analyze functions
        const functions = functionAnalyzer.analyzeFunctions(sourceFile, filePath);
        totalFunctions += functions.length;
        
        // Analyze classes
        const classes = sourceFile.getClasses().map(c => c.getName() || 'anonymous');
        totalClasses += classes.length;
        
        // Resolve imports
        const imports = importResolver.resolveAllImports(sourceFile);
        resolvedImports += imports.filter(imp => imp.isResolved).length;
        
        // Get exports
        const exports = sourceFile.getExportedDeclarations();
        const exportNames = Array.from(exports.keys());
        
        // Calculate file metrics
        const fileSize = sourceFile.getFullText().length;
        const fileComplexity = functions.reduce((sum, func) => sum + func.complexity, 0);
        
        fileNodes.push({
            path: filePath,
            functions,
            classes,
            imports,
            exports: exportNames,
            complexity: fileComplexity,
            size: fileSize
        });

        // Create graph node with enhanced info
        const directoryGroup = path.dirname(filePath);
        graphNodes.push({
            id: filePath,
            label: path.basename(filePath),
            type: 'file',
            group: directoryGroup,
            complexity: fileComplexity,
            size: fileSize
        });
        
        // Create code chunks
        codeChunks.push({
            id: `file:${filePath}`,
            filePath,
            content: `File: ${filePath}\nFunctions: ${functions.map(f => f.name).join(', ')}\nImports: ${imports.map(i => i.original).join(', ')}\nExports: ${exportNames.join(', ')}`,
            lineStart: 1,
            lineEnd: sourceFile.getEndLineNumber(),
            type: 'file'
        });
        
        // Add function chunks
        functions.forEach(func => {
            codeChunks.push({
                id: `${filePath}:${func.name}`,
                filePath,
                functionName: func.name,
                content: `Function: ${func.name}\nParameters: ${func.parameters.join(', ')}\nComplexity: ${func.complexity}\nLines: ${func.startLine}-${func.endLine}`,
                lineStart: func.startLine,
                lineEnd: func.endLine,
                type: 'function'
            });
        });

        // Create import edges
        imports.forEach(imp => {
            if (imp.isResolved && imp.resolved) {
                graphEdges.push({
                    id: `${filePath}->${imp.resolved}`,
                    source: filePath,
                    target: imp.resolved,
                    type: 'imports',
                    weight: imp.importedMembers.length || 1
                });
            } else if (imp.isExternal) {
                // Create external dependency node
                const externalId = `external:${imp.original}`;
                if (!graphNodes.some(n => n.id === externalId)) {
                    graphNodes.push({
                        id: externalId,
                        label: imp.original,
                        type: 'external'
                    });
                }
                
                graphEdges.push({
                    id: `${filePath}->${externalId}`,
                    source: filePath,
                    target: externalId,
                    type: 'imports',
                    weight: 1
                });
            }
        });
    }
    
    // Analyze function calls
    const functionCalls = callAnalyzer.findFunctionCalls(sourceFiles);
    
    // Analyze architecture
    const architectureDetector = new ArchitectureDetector(fileNodes, normalizedRepoPath);
    const architecture = architectureDetector.detectArchitecture();

    return {
        metrics: {
            files: sourceFiles.length,
            functions: totalFunctions,
            classes: totalClasses,
            dependencies: graphEdges.filter(e => e.type === 'imports').length,
            resolvedImports,
            functionCalls: functionCalls.length
        },
        files: fileNodes,
        graph: {
            nodes: graphNodes,
            edges: graphEdges
        },
        functionCalls,
        codeChunks,
        architecture
    };
}
