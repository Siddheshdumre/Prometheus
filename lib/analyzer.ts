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
    type: 'Next.js App' | 'React SPA' | 'Node.js API' | 'Component-Service' | 'Layered' | 'Micro-Frontend' | 'Custom' |
          'Django' | 'Flask' | 'FastAPI' | 'Data Science' | 'Python Package' | 'Generic Python' |
          'Spring Boot' | 'Java Maven' | 'Android' | 'Generic Java' |
          'Go Module' | 'Rust Crate' | 'Ruby on Rails' | 'Generic';
    confidence: number;
    description: string;
    characteristics: string[];
    primaryLanguage?: string;
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
    summary?: string;
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
    private tsconfigAliases: Array<{ prefix: string; targetDir: string }> = [];

    constructor(private repoPath: string, private sourceFiles: SourceFile[]) {
        this.loadTsconfigPaths();
    }

    private loadTsconfigPaths() {
        const tsconfigPath = path.join(this.repoPath, 'tsconfig.json');
        try {
            let content = fs.readFileSync(tsconfigPath, 'utf8');
            // Strip comments (tsconfig.json allows them)
            content = content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
            const tsconfig = JSON.parse(content);
            const compilerOptions = tsconfig.compilerOptions || {};
            const baseUrl = compilerOptions.baseUrl || '.';
            const paths: Record<string, string[]> = compilerOptions.paths || {};
            const baseDir = path.resolve(this.repoPath, baseUrl);
            for (const [alias, targets] of Object.entries(paths)) {
                if (!Array.isArray(targets) || targets.length === 0) continue;
                const cleanAlias = alias.replace(/\/\*$/, '');
                const cleanTarget = targets[0].replace(/\/\*$/, '');
                this.tsconfigAliases.push({
                    prefix: cleanAlias,
                    targetDir: path.resolve(baseDir, cleanTarget),
                });
            }
        } catch { /* tsconfig.json not found or unparseable — skip */ }
    }

    private tryResolve(resolvedBase: string): string | null {
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
        for (const ext of extensions) {
            const testPath = resolvedBase + ext;
            const relativePath = path.relative(this.repoPath, testPath).replace(/\\/g, '/');
            if (this.sourceFiles.some(sf => {
                const sfRelative = path.relative(this.repoPath, sf.getFilePath()).replace(/\\/g, '/');
                return sfRelative === relativePath;
            })) {
                return relativePath;
            }
        }
        return null;
    }

    resolveImportPath(importPath: string, currentFilePath: string): string | null {
        // Handle relative imports (./ and ../)
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const currentDir = path.dirname(currentFilePath);
            return this.tryResolve(path.resolve(currentDir, importPath));
        }

        // Handle @/ alias (Next.js convention — maps to repo root)
        if (importPath.startsWith('@/')) {
            return this.tryResolve(path.join(this.repoPath, importPath.slice(2)));
        }

        // Handle tsconfig.json path aliases (e.g. ~/, src/, @components/, etc.)
        for (const { prefix, targetDir } of this.tsconfigAliases) {
            if (importPath === prefix || importPath.startsWith(prefix + '/')) {
                const rest = importPath.slice(prefix.length).replace(/^\//, '');
                const result = this.tryResolve(path.join(targetDir, rest));
                if (result) return result;
            }
        }

        return null;
    }

    resolveAllImports(sourceFile: SourceFile): ResolvedImport[] {
        const imports = sourceFile.getImportDeclarations();
        const currentFilePath = sourceFile.getFilePath();
        
        return imports.map(importDecl => {
            const original = importDecl.getModuleSpecifierValue();
            const resolved = this.resolveImportPath(original, currentFilePath);
            const isExternal = !original.startsWith('./') && !original.startsWith('../') && resolved === null;
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

// ═══════════════════════════════════════════════════════════════════════════
// FILE SUMMARY GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateFileSummary(filePath: string, functions: FunctionInfo[], classes: string[], exports: string[], imports: ResolvedImport[]): string {
    const name = path.basename(filePath);
    const dir = path.dirname(filePath).split('/').filter(Boolean);
    const ext = path.extname(filePath);
    const lineCount = functions.reduce((sum, f) => sum + (f.endLine - f.startLine), 0);
    const isLargeFile = lineCount > 500;
    const isCoreFile = lineCount > 1000;
    
    // Extract context from directory names
    const parentDir = dir[dir.length - 1] || '';
    const grandParentDir = dir[dir.length - 2] || '';
    
    // Analyze function names for clues
    const functionNames = functions.map(f => f.name.toLowerCase());
    const hasRouteHandlers = functionNames.some(n => /^(get|post|put|delete|patch|head|options)$/i.test(n));
    const hasAuthFunctions = functionNames.some(n => /auth|login|logout|verify|token/i.test(n));
    const hasValidation = functionNames.some(n => /valid|check|verify|sanitize/i.test(n));
    const hasCRUD = functionNames.some(n => /create|read|update|delete|fetch|save|remove/i.test(n));
    
    // Component/Page detection with better context
    if (name.match(/^(layout|page|error|loading|not-found|template)\.(tsx?|jsx?)$/i)) {
        const type = name.split('.')[0];
        if (type === 'layout') return 'Root layout component';
        if (type === 'page') {
            // Check parent directory for context
            if (parentDir === 'dashboard' || parentDir === 'analytics') return 'Analytics dashboard';
            if (parentDir === 'admin') return 'Admin panel interface';
            if (parentDir === 'settings') return 'Settings page';
            if (parentDir === 'profile') return 'User profile page';
            return 'Main application code';
        }
        if (type === 'error') return 'Error boundary handler';
        if (type === 'loading') return 'Loading state UI';
        return 'Route component';
    }
    
    // Module files (Angular, NestJS, etc.)
    if (name.match(/\.module\.(ts|js)$/i)) {
        if (name.includes('app.module')) return 'Root module - declares all components';
        if (name.includes('routing')) return 'Routing configuration';
        return `${parentDir} module configuration`;
    }
    
    // Config files with better descriptions
    if (name.match(/^(config|configuration|settings|constants|env)\./i)) {
        if (name.includes('api') || name.includes('http')) return 'API configuration';
        if (name.includes('db') || name.includes('database')) return 'Database configuration';
        return 'Application settings';
    }
    if (name === 'tsconfig.json') return 'TypeScript compiler config';
    if (name === 'package.json') return 'Dependencies manifest';
    if (name.match(/^(tailwind|postcss)\.config/i)) return 'Styling configuration';
    if (name.match(/^(next|vite|webpack)\.config/i)) return 'Build tool setup';
    
    // Routes/API with context awareness
    if (dir.includes('api') || dir.includes('routes')) {
        if (name === 'route.ts' || name === 'route.js') {
            if (parentDir === 'chat') return 'AI chat endpoint';
            if (parentDir === 'analyze') return 'Repository analysis endpoint';
            if (parentDir === 'content') return 'File content reader';
            if (parentDir === 'auth') return 'Authentication API';
            return 'API endpoint handler';
        }
        if (hasRouteHandlers) return 'HTTP request handlers';
        if (hasCRUD) return `${parentDir} CRUD operations`;
        return 'API route logic';
    }
    
    // Auth/Guards with specificity
    if (name.match(/(auth|guard|middleware|protect)/i)) {
        if (name.includes('guard')) return 'Route guard for authentication';
        if (name.includes('middleware')) return 'Auth middleware';
        if (hasAuthFunctions) return 'Authentication service';
        return 'Security logic';
    }
    
    // Types/Interfaces
    if (name.match(/^(types|interfaces|models|schemas)\./i) || name.includes('.types.') || name.includes('.d.ts')) {
        if (parentDir) return `${parentDir} type definitions`;
        return 'Type declarations';
    }
    
    // Tests
    if (name.match(/\.(test|spec)\.(tsx?|jsx?)$/)) {
        const testTarget = name.replace(/\.(test|spec)\.(tsx?|jsx?)$/, '');
        return `Tests for ${testTarget}`;
    }
    
    // Utils/Helpers with specific roles
    if (dir.includes('utils') || dir.includes('helpers') || dir.includes('lib')) {
        if (name.includes('date') || name.includes('time')) return 'Date/time helpers';
        if (name.includes('format')) return 'Data formatting utils';
        if (name.includes('validate') || name.includes('validator')) return 'Input validation';
        if (name.includes('api') || name.includes('http') || name.includes('fetch')) return 'HTTP client utilities';
        if (name.includes('string')) return 'String manipulation';
        if (name.includes('array')) return 'Array utilities';
        if (name.includes('analyzer') || name.includes('parser')) {
            const suffix = isCoreFile ? ` (${lineCount} lines - core engine)` : isLargeFile ? ` (${lineCount} lines)` : '';
            return `Code analysis engine${suffix}`;
        }
        if (exports.length > 8) return 'Shared utility collection';
        return 'Helper functions';
    }
    
    // Components with better context
    if (dir.includes('components') || ext.match(/\.(tsx|jsx)$/)) {
        // Specific component detection with context
        if (name.match(/workspace/i)) return 'Main workspace container';
        if (name.match(/dashboard/i)) return 'Dashboard view';
        if (name.match(/sidebar/i)) return 'Navigation sidebar';
        if (name.match(/header/i)) return 'Page header';
        if (name.match(/footer/i)) return 'Page footer';
        if (name.match(/navbar|navigation/i)) return 'Navigation bar';
        if (name.match(/menu/i)) return 'Menu component';
        
        if (name.match(/button|btn/i)) return 'Button component';
        if (name.match(/modal|dialog/i)) return 'Modal dialog';
        if (name.match(/form/i)) return 'Form component';
        if (name.match(/input|field/i)) return 'Input field';
        if (name.match(/table|grid/i)) return 'Data table';
        if (name.match(/list/i)) return 'List display';
        if (name.match(/card/i)) return 'Card component';
        if (name.match(/viewer/i)) {
            if (parentDir || grandParentDir) return `${parentDir || grandParentDir} viewer`;
            return 'Content viewer';
        }
        if (name.match(/editor/i)) return 'Content editor';
        if (name.match(/tree|explorer/i)) return 'Tree explorer';
        if (name.match(/palette/i)) return 'Command palette';
        if (name.match(/chart|graph/i)) return 'Data visualization';
        if (name.match(/tooltip/i)) return 'Tooltip overlay';
        if (name.match(/dropdown|select/i)) return 'Dropdown menu';
        if (name.match(/tabs?/i)) return 'Tab navigation';
        if (name.match(/accordion/i)) return 'Accordion panel';
        if (name.match(/badge|tag/i)) return 'Badge component';
        if (name.match(/avatar/i)) return 'Avatar display';
        if (name.match(/icon/i)) return 'Icon component';
        if (name.match(/spinner|loader/i)) return 'Loading indicator';
        if (name.match(/alert|toast|notification/i)) return 'Notification UI';
        
        // Context/Providers
        if (name.match(/(context|provider)/i)) return 'React context provider';
        
        // Hooks
        if (name.match(/^use[A-Z]/)) {
            const hookName = name.replace(/^use/, '').replace(/\.(tsx?|jsx?)$/, '');
            return `Custom ${hookName.toLowerCase()} hook`;
        }
        
        // Generic with parent context
        if (parentDir && parentDir !== 'components') return `${parentDir} UI component`;
        return 'UI component';
    }
    
    // Services with business logic hints
    if (dir.includes('services') || dir.includes('service')) {
        if (name.includes('auth')) return 'Authentication service';
        if (name.includes('api') || name.includes('http')) return 'API client service';
        if (name.includes('storage') || name.includes('cache')) return 'Data persistence';
        if (name.includes('socket') || name.includes('websocket')) return 'WebSocket service';
        if (name.includes('notification')) return 'Notification service';
        if (hasCRUD) return `${parentDir} data service`;
        return 'Business logic layer';
    }
    
    // Stores/State
    if (dir.includes('store') || dir.includes('state') || name.includes('store') || name.includes('slice')) {
        if (parentDir) return `${parentDir} state store`;
        return 'State management';
    }
    
    // Styles
    if (ext.match(/\.(css|scss|sass|less|styl)$/)) {
        if (name === 'globals.css' || name === 'global.css') return 'Global stylesheet';
        if (name.includes('theme')) return 'Theme variables';
        if (name.includes('variables')) return 'Style variables';
        return 'Component styles';
    }
    
    // Database/Models
    if (dir.includes('models') || dir.includes('entities') || dir.includes('schema')) {
        if (parentDir) return `${parentDir} data model`;
        return 'Database schema';
    }
    
    // Python specific with Django context
    if (ext === '.py') {
        if (name === '__init__.py') return 'Package initializer';
        if (name === 'manage.py') return 'Django CLI tool';
        if (name === 'settings.py') return 'Django configuration';
        if (name === 'urls.py') return 'URL routing map';
        if (name === 'views.py') {
            if (hasCRUD) return 'View handlers with CRUD';
            return 'Request handlers';
        }
        if (name === 'models.py') return 'ORM model definitions';
        if (name === 'forms.py') return 'Form classes';
        if (name === 'admin.py') return 'Django admin config';
        if (name === 'serializers.py') return 'API serializers';
        if (name === 'tasks.py') return 'Background tasks';
        if (name === 'celery.py') return 'Celery configuration';
        if (name.includes('test_')) return `Unit tests for ${name.replace('test_', '').replace('.py', '')}`;
    }
    
    // Java specific with Spring context
    if (ext === '.java') {
        if (classes.some(c => c.endsWith('Controller'))) return `${parentDir} REST controller`;
        if (classes.some(c => c.endsWith('Service'))) return `${parentDir} service layer`;
        if (classes.some(c => c.endsWith('Repository'))) return `${parentDir} data repository`;
        if (classes.some(c => c.endsWith('Entity'))) return `${parentDir} database entity`;
        if (classes.some(c => c.endsWith('DTO'))) return 'Data transfer object';
        if (classes.some(c => c.endsWith('Config'))) return 'Spring configuration';
        if (name.includes('Application')) return 'Spring Boot entry point';
    }
    
    // Markdown/Documentation
    if (ext === '.md') {
        if (name === 'README.md') return 'Project documentation';
        if (name.includes('CHANGELOG')) return 'Version history';
        if (name.includes('CONTRIBUTING')) return 'Contribution guide';
        if (name.includes('LICENSE')) return 'License terms';
        return 'Documentation';
    }
    
    // Based on exports/functions with size context
    if (isCoreFile) {
        return `${parentDir || 'Core'} module (${lineCount} lines - major component)`;
    }
    if (isLargeFile) {
        if (exports.length > 10) return `${parentDir} utilities (${lineCount} lines)`;
        if (functions.length > 15) return `${parentDir} logic (${lineCount} lines)`;
    }
    if (exports.length > 8) return 'Shared utilities';
    if (classes.length > 2) return `${classes.length} class definitions`;
    if (functions.length > 10) return 'Function library';
    
    // Fallback based on extension
    if (ext === '.json') {
        if (name.includes('lock')) return 'Dependency lock file';
        return 'JSON configuration';
    }
    if (ext.match(/\.(yml|yaml)$/)) return 'YAML config';
    if (ext === '.sql') return 'SQL queries';
    if (ext === '.sh') return 'Shell script';
    if (ext === '.dockerfile' || name === 'Dockerfile') return 'Docker image config';
    if (ext === '.env') return 'Environment variables';
    if (ext === '.gitignore') return 'Git ignore rules';
    
    // Generic fallback with context
    if (functions.length > 0 && classes.length > 0) return `${parentDir || 'Mixed'} module`;
    if (functions.length > 0) return `${parentDir || 'Function'} module`;
    if (classes.length > 0) return `${parentDir || 'Class'} definitions`;
    if (parentDir) return `${parentDir} file`;
    
    return 'Source file';
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-LANGUAGE SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

interface LangCounts { [lang: string]: number }

const SKIP_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', '__pycache__',
    '.venv', 'venv', 'env', 'target', 'out', '.gradle', '.idea',
    '.vscode', 'vendor', 'coverage', '.cache', 'bin', 'obj', '.mypy_cache',
    '.pytest_cache', '.tox', 'eggs', '.eggs', 'htmlcov',
]);

function loadGitignorePatterns(repoPath: string): Set<string> {
    const gitignorePath = path.join(repoPath, '.gitignore');
    const ignoredNames = new Set<string>();
    try {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
            // Only handle simple name-only patterns (no slashes, no wildcards)
            // e.g. "dist", ".env", "coverage" — skip glob patterns like "*.log"
            const normalized = trimmed.replace(/\/$/, '').replace(/^\//, '');
            if (normalized && !normalized.includes('/') && !normalized.includes('*') && !normalized.includes('?')) {
                ignoredNames.add(normalized);
            }
        }
    } catch { /* .gitignore not found or unreadable */ }
    return ignoredNames;
}

function walkDir(dir: string, extraSkip?: Set<string>): string[] {
    const results: string[] = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            if (extraSkip?.has(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) results.push(...walkDir(full, extraSkip));
            else results.push(full);
        }
    } catch { /* skip unreadable */ }
    return results;
}

function detectLanguages(files: string[]): LangCounts {
    const EXT_MAP: Record<string, string> = {
        '.ts': 'typescript', '.tsx': 'typescript',
        '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
        '.py': 'python', '.ipynb': 'jupyter',
        '.java': 'java',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.cs': 'csharp',
        '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
        '.c': 'c',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.r': 'r',
    };
    const counts: LangCounts = {};
    for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        const lang = EXT_MAP[ext];
        if (lang) counts[lang] = (counts[lang] || 0) + 1;
    }
    return counts;
}

// ─── Python Analyzer ─────────────────────────────────────────────────────────

class PythonFileAnalyzer {
    analyzeFile(filePath: string, content: string, repoPath: string): FileNode {
        const relativePath = path.relative(repoPath, filePath).replace(/\\/g, '/');
        const lines = content.split('\n');

        // 1. Functions (def / async def)
        const functions: FunctionInfo[] = [];
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/);
            if (!m) continue;
            const name = m[2];
            const rawParams = m[3].split(',')
                .map(p => p.trim().split(':')[0].split('=')[0].replace(/^\*+/, '').trim())
                .filter(Boolean);
            const indent = m[1].length;
            // find end line
            let endLine = lines.length;
            for (let j = i + 1; j < lines.length; j++) {
                const tl = lines[j].trimStart();
                if (!tl || tl.startsWith('#')) continue;
                const ind = lines[j].length - tl.length;
                if (ind <= indent && tl.length > 0 && (/^(?:async\s+)?def\s|^class\s/.test(tl))) {
                    endLine = j;
                    break;
                }
            }
            const cx = this.calcComplexity(lines.slice(i, Math.min(i + 80, endLine)));
            functions.push({ name, startLine: i + 1, endLine, complexity: cx, parameters: rawParams, isExported: !name.startsWith('_') });
        }

        // 2. Classes
        const classes: string[] = [];
        for (const line of lines) {
            const m = line.match(/^class\s+(\w+)/);
            if (m) classes.push(m[1]);
        }

        // 3. Imports
        const imports: ResolvedImport[] = [];
        for (const line of lines) {
            const stripped = line.trim();
            const imp1 = stripped.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?$/);
            if (imp1) {
                const mod = imp1[1];
                const resolved = this.resolveModule(mod, filePath, repoPath);
                imports.push({ original: mod, resolved, isExternal: !resolved, isResolved: !!resolved, importedMembers: [] });
                continue;
            }
            const imp2 = stripped.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
            if (imp2) {
                const mod = imp2[1];
                const members = imp2[2].trim() === '*' ? [] :
                    imp2[2].replace(/[()]/g, '').split(',').map(s => s.trim().split(' as ')[0].trim()).filter(Boolean);
                const resolved = this.resolveModule(mod, filePath, repoPath);
                imports.push({ original: mod, resolved, isExternal: !resolved, isResolved: !!resolved, importedMembers: members });
            }
        }

        // 4. Exports (__all__ or public by convention)
        const exports: string[] = [];
        const allMatch = content.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
        if (allMatch) {
            const ms = allMatch[1].match(/['"](\w+)['"]/g);
            if (ms) exports.push(...ms.map(s => s.replace(/['"]/g, '')));
        } else {
            exports.push(...functions.filter(f => f.isExported).map(f => f.name));
            exports.push(...classes.filter(c => !c.startsWith('_')));
        }

        const complexity = Math.max(1, functions.reduce((s, f) => s + f.complexity, 0));
        const summary = generateFileSummary(relativePath, functions, classes, exports, imports);
        return { path: relativePath, functions, classes, imports, exports, complexity, size: content.length, summary };
    }

    private calcComplexity(lines: string[]): number {
        let cx = 1;
        for (const line of lines) {
            if (line.trim().startsWith('#')) continue;
            const m = line.match(/\b(if|elif|else|for|while|try|except|finally|with|and|or|lambda)\b/g);
            if (m) cx += m.length;
        }
        return cx;
    }

    resolveModule(mod: string, filePath: string, repoPath: string): string | null {
        const dotMatch = mod.match(/^(\.+)(.*)/);
        if (dotMatch) {
            const dots = dotMatch[1].length;
            const rest = dotMatch[2].replace(/\./g, path.sep);
            let base = path.dirname(filePath);
            for (let i = 1; i < dots; i++) base = path.dirname(base);
            for (const c of [path.join(base, rest + '.py'), path.join(base, rest, '__init__.py')]) {
                if (fs.existsSync(c)) return path.relative(repoPath, c).replace(/\\/g, '/');
            }
            return null;
        }
        const parts = mod.split('.');
        for (const c of [path.join(repoPath, ...parts) + '.py', path.join(repoPath, ...parts, '__init__.py')]) {
            if (fs.existsSync(c)) return path.relative(repoPath, c).replace(/\\/g, '/');
        }
        return null;
    }
}

// ─── Jupyter Notebook Analyzer ───────────────────────────────────────────────

class JupyterAnalyzer {
    private pyAnalyzer = new PythonFileAnalyzer();

    analyzeFile(filePath: string, content: string, repoPath: string): FileNode | null {
        let notebook: any;
        try { notebook = JSON.parse(content); } catch { return null; }
        const cells: any[] = notebook.cells || notebook.worksheets?.[0]?.cells || [];
        const codeSource = cells
            .filter((c: any) => c.cell_type === 'code')
            .map((c: any) => (Array.isArray(c.source) ? c.source.join('') : c.source))
            .join('\n');
        const node = this.pyAnalyzer.analyzeFile(filePath, codeSource, repoPath);
        const relativePath = path.relative(repoPath, filePath).replace(/\\/g, '/');
        return { ...node, path: relativePath };
    }
}

// ─── Java Analyzer ───────────────────────────────────────────────────────────

class JavaFileAnalyzer {
    private static JAVA_KEYWORDS = new Set([
        'if', 'while', 'for', 'switch', 'try', 'catch', 'new', 'return',
        'throw', 'class', 'interface', 'enum', 'assert', 'super', 'this',
    ]);

    analyzeFile(filePath: string, content: string, repoPath: string): FileNode {
        const relativePath = path.relative(repoPath, filePath).replace(/\\/g, '/');
        const lines = content.split('\n');

        const classes: string[] = [];
        for (const line of lines) {
            const m = line.match(/\b(?:class|interface|enum)\s+(\w+)/);
            if (m && !line.trim().startsWith('//') && !line.trim().startsWith('*')) classes.push(m[1]);
        }

        const METHOD_RE = /^\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*(?:public|private|protected)\s+(?:(?:static|final|abstract|synchronized|native|default|transient|volatile)\s+)*(?:<[^>]+>\s+)?(?:[\w$<>\[\]?,\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*[{;]/;
        const functions: FunctionInfo[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
            const m = line.match(METHOD_RE);
            if (!m) continue;
            const name = m[1];
            if (JavaFileAnalyzer.JAVA_KEYWORDS.has(name)) continue;
            const params = m[2] ? m[2].split(',').map(p => p.trim().split(/\s+/).pop() || '').filter(Boolean) : [];
            functions.push({
                name, startLine: i + 1,
                endLine: Math.min(i + 30, lines.length),
                complexity: this.calcComplexity(lines, i),
                parameters: params,
                isExported: line.includes('public'),
            });
        }

        const imports: ResolvedImport[] = [];
        for (const line of lines) {
            const m = line.match(/^import\s+(?:static\s+)?([\w.]+)(?:\.\*)?;/);
            if (m) imports.push({ original: m[1], resolved: null, isExternal: true, isResolved: false, importedMembers: [] });
        }

        const complexity = Math.max(1, functions.reduce((s, f) => s + f.complexity, 0));
        const summary = generateFileSummary(relativePath, functions, classes, classes, imports);
        return { path: relativePath, functions, classes, imports, exports: classes, complexity, size: content.length, summary };
    }

    private calcComplexity(lines: string[], start: number): number {
        let cx = 1;
        for (let i = start + 1; i < Math.min(start + 60, lines.length); i++) {
            if (lines[i].trim().startsWith('//') || lines[i].trim().startsWith('*')) continue;
            const m = lines[i].match(/\b(if|else\s+if|while|for|case|catch)\b|&&|\|\|/g);
            if (m) cx += m.length;
        }
        return cx;
    }
}

// ─── Generic File Analyzer (Go, Rust, Ruby, C#, PHP, etc.) ──────────────────

const GENERIC_LANG_PATTERNS: Record<string, { func: RegExp; imp: RegExp; cls?: RegExp }> = {
    go:      { func: /^func(?:\s+\([^)]+\))?\s+(\w+)\s*[(<]/m, imp: /^import\s+"([^"]+)"/m,              cls: /^type\s+(\w+)\s+struct/m },
    rust:    { func: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]/m, imp: /^use\s+([\w:]+)/m,             cls: /^(?:pub\s+)?(?:struct|enum|trait|impl)\s+(\w+)/m },
    ruby:    { func: /^\s*def\s+(\w+)/m, imp: /^require(?:_relative)?\s+['"]([\w/.]+)['"]/m,              cls: /^class\s+(\w+)/m },
    php:     { func: /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+(\w+)\s*\(/m,        imp: /^(?:use|require|include)\s+['"]([\w/\\]+)['"]/m, cls: /^(?:abstract\s+)?class\s+(\w+)/m },
    csharp:  { func: /^\s*(?:public|private|protected|internal|static|virtual|override|abstract|\s)*(?:(?:async)\s+)?(?:[\w<>\[\]?]+)\s+(\w+)\s*\([^)]*\)\s*[{;]/m, imp: /^using\s+([\w.]+);/m, cls: /\b(?:class|interface|enum|struct)\s+(\w+)/m },
    kotlin:  { func: /^\s*(?:fun)\s+(\w+)\s*[(<]/m, imp: /^import\s+([\w.]+)/m,                          cls: /\b(?:class|interface|object|data\s+class)\s+(\w+)/m },
    scala:   { func: /^\s*(?:def)\s+(\w+)\s*[(<]/m, imp: /^import\s+([\w.]+)/m,                          cls: /\b(?:class|trait|object|case\s+class)\s+(\w+)/m },
    swift:   { func: /^\s*(?:func)\s+(\w+)\s*[(<]/m, imp: /^import\s+(\w+)/m,                            cls: /\b(?:class|struct|enum|protocol)\s+(\w+)/m },
};

class GenericFileAnalyzer {
    analyzeFile(filePath: string, content: string, repoPath: string, language: string): FileNode {
        const relativePath = path.relative(repoPath, filePath).replace(/\\/g, '/');
        const lines = content.split('\n');
        const pat = GENERIC_LANG_PATTERNS[language];
        const functions: FunctionInfo[] = [];
        const classes: string[] = [];
        const imports: ResolvedImport[] = [];

        if (pat) {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const mf = line.match(pat.func);
                if (mf) functions.push({ name: mf[1], startLine: i + 1, endLine: i + 1, complexity: 1, parameters: [], isExported: true });
                const mi = line.match(pat.imp);
                if (mi) imports.push({ original: mi[1], resolved: null, isExternal: true, isResolved: false, importedMembers: [] });
                if (pat.cls) {
                    const mc = line.match(pat.cls);
                    if (mc && !classes.includes(mc[1])) classes.push(mc[1]);
                }
            }
        } else {
            for (let i = 0; i < lines.length; i++) {
                const m = lines[i].match(/(?:function|def|fn|func|sub)\s+(\w+)\s*[\({]/);
                if (m) functions.push({ name: m[1], startLine: i + 1, endLine: i + 1, complexity: 1, parameters: [], isExported: true });
            }
        }

        const complexity = Math.max(1, functions.length);
        const summary = generateFileSummary(relativePath, functions, classes, functions.filter(f => f.isExported).map(f => f.name), imports);
        return {
            path: relativePath, functions, classes, imports,
            exports: functions.filter(f => f.isExported).map(f => f.name),
            complexity, size: content.length, summary,
        };
    }
}

class ArchitectureDetector {
    private files: FileNode[];
    private repoPath: string;
    private langCounts: LangCounts;

    constructor(files: FileNode[], repoPath: string, langCounts: LangCounts = {}) {
        this.files = files;
        this.repoPath = repoPath;
        this.langCounts = langCounts;
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
        const repoFiles = (() => { try { return walkDir(this.repoPath); } catch { return []; } })();
        const hasFile = (name: string) => repoFiles.some(f => path.basename(f) === name);
        const hasDir  = (d: string)    => repoFiles.some(f => f.replace(/\\/g, '/').includes(`/${d}/`));
        const pyCount = (this.langCounts.python || 0) + (this.langCounts.jupyter || 0);
        const javaCount = this.langCounts.java || 0;
        const tsJsCount = (this.langCounts.typescript || 0) + (this.langCounts.javascript || 0);

        // ── Python patterns ────────────────────────────────────────────────
        if (pyCount > 0 && pyCount >= tsJsCount) {
            // Data Science: notebooks + data science libs
            const notebookCount = this.langCounts.jupyter || 0;
            const hasDataLibs = repoFiles.some(f => {
                if (!f.endsWith('requirements.txt') && !f.endsWith('pyproject.toml')) return false;
                try { const c = fs.readFileSync(f, 'utf8'); return /pandas|numpy|sklearn|torch|tensorflow|matplotlib|seaborn|scipy|xgboost|lightgbm/i.test(c); } catch { return false; }
            });
            if (notebookCount > 0 || hasDataLibs) {
                return {
                    type: 'Data Science', confidence: 0.92,
                    description: 'Data science / ML project using Python notebooks and scientific libraries',
                    characteristics: [
                        ...(notebookCount > 0 ? ['Jupyter Notebooks'] : []),
                        ...(hasDataLibs ? ['Scientific libraries (pandas / numpy / sklearn)'] : []),
                        'Python scripting', 'Experimental workflows',
                    ], primaryLanguage: 'Python',
                };
            }

            // Django
            if (hasFile('manage.py') || (hasDir('migrations') && filePaths.some(p => p.includes('models') || p.includes('views')))) {
                return {
                    type: 'Django', confidence: 0.93,
                    description: 'Django web application with MTV architecture',
                    characteristics: ['Model-Template-View', 'ORM', 'URL routing', 'Admin interface', 'Migrations'],
                    primaryLanguage: 'Python',
                };
            }

            // FastAPI
            const hasFastAPI = repoFiles.some(f => {
                if (!f.endsWith('.py')) return false;
                try { return fs.readFileSync(f, 'utf8').includes('FastAPI') || fs.readFileSync(f, 'utf8').includes('fastapi'); } catch { return false; }
            });
            if (hasFastAPI) {
                return {
                    type: 'FastAPI', confidence: 0.9,
                    description: 'FastAPI async REST API',
                    characteristics: ['Async endpoints', 'Pydantic models', 'OpenAPI/Swagger', 'Dependency injection'],
                    primaryLanguage: 'Python',
                };
            }

            // Flask
            const hasFlask = repoFiles.some(f => {
                if (!f.endsWith('.py')) return false;
                try { const c = fs.readFileSync(f, 'utf8'); return /from flask import|import flask/i.test(c); } catch { return false; }
            });
            if (hasFlask) {
                return {
                    type: 'Flask', confidence: 0.88,
                    description: 'Flask lightweight web application',
                    characteristics: ['Route decorators', 'Blueprint structure', 'Jinja2 templating', 'WSGI app'],
                    primaryLanguage: 'Python',
                };
            }

            // Python package
            if (hasFile('setup.py') || hasFile('pyproject.toml') || hasFile('setup.cfg')) {
                return {
                    type: 'Python Package', confidence: 0.85,
                    description: 'Distributable Python package / library',
                    characteristics: ['Package metadata', 'Module exports', hasFile('pyproject.toml') ? 'PEP 517 build' : 'setuptools'],
                    primaryLanguage: 'Python',
                };
            }

            return {
                type: 'Generic Python', confidence: 0.7,
                description: 'Python application or scripts',
                characteristics: ['Python scripting', 'Module structure'],
                primaryLanguage: 'Python',
            };
        }

        // ── Java patterns ─────────────────────────────────────────────────
        if (javaCount > 0 && javaCount >= tsJsCount) {
            // Android
            if (hasFile('AndroidManifest.xml')) {
                return {
                    type: 'Android', confidence: 0.95,
                    description: 'Android mobile application (Java/Kotlin)',
                    characteristics: ['Activity/Fragment lifecycle', 'Manifest-driven', 'Gradle build', 'Android SDK'],
                    primaryLanguage: 'Java',
                };
            }
            // Spring Boot
            const hasSpring = repoFiles.some(f => {
                if (!f.endsWith('.java')) return false;
                try { const c = fs.readFileSync(f, 'utf8'); return /@SpringBootApplication|@RestController|@Service|@Repository|@Component/.test(c); } catch { return false; }
            });
            if (hasSpring) {
                return {
                    type: 'Spring Boot', confidence: 0.92,
                    description: 'Spring Boot Java/Kotlin application',
                    characteristics: ['Dependency injection', 'REST controllers', 'JPA repositories', 'Spring MVC'],
                    primaryLanguage: 'Java',
                };
            }
            if (hasFile('pom.xml')) {
                return {
                    type: 'Java Maven', confidence: 0.85,
                    description: 'Java Maven project',
                    characteristics: ['Maven build system', 'Standard directory layout', 'Dependency management'],
                    primaryLanguage: 'Java',
                };
            }
            return {
                type: 'Generic Java', confidence: 0.7,
                description: 'Java application',
                characteristics: ['OOP design', 'Java modules'],
                primaryLanguage: 'Java',
            };
        }

        // ── Go ────────────────────────────────────────────────────────────
        if ((this.langCounts.go || 0) > 0) {
            return {
                type: 'Go Module', confidence: 0.85,
                description: 'Go module / application',
                characteristics: ['Go modules', 'Package-based structure', hasFile('main.go') ? 'Executable binary' : 'Library'],
                primaryLanguage: 'Go',
            };
        }

        // ── Rust ──────────────────────────────────────────────────────────
        if ((this.langCounts.rust || 0) > 0) {
            return {
                type: 'Rust Crate', confidence: 0.85,
                description: 'Rust crate / application',
                characteristics: ['Cargo package manager', 'Ownership model', hasFile('main.rs') ? 'Binary crate' : 'Library crate'],
                primaryLanguage: 'Rust',
            };
        }

        // ── Ruby ──────────────────────────────────────────────────────────
        if ((this.langCounts.ruby || 0) > 0) {
            if (hasFile('Gemfile') && (hasDir('app') || hasDir('config'))) {
                return {
                    type: 'Ruby on Rails', confidence: 0.9,
                    description: 'Ruby on Rails MVC application',
                    characteristics: ['MVC architecture', 'ActiveRecord ORM', 'Convention over configuration', 'Gem dependencies'],
                    primaryLanguage: 'Ruby',
                };
            }
        }

        // ── TypeScript / JavaScript (existing logic) ──────────────────────
        if (filePaths.some(p => p.includes('app/') && p.endsWith('page.tsx')) ||
            filePaths.some(p => p.includes('next.config'))) {
            return {
                type: 'Next.js App', confidence: 0.9,
                description: 'Next.js application with App Router structure',
                characteristics: ['App directory structure', 'Page-based routing', 'API routes', 'Server and client components'],
            };
        }
        if (filePaths.some(p => p.includes('src/') && p.includes('component')) ||
            filePaths.some(p => p.includes('public/index.html'))) {
            return {
                type: 'React SPA', confidence: 0.8,
                description: 'Single Page Application with React',
                characteristics: ['Component-based architecture', 'Client-side routing', 'Bundled assets'],
            };
        }
        if (filePaths.some(p => p.includes('routes/') || p.includes('controllers/')) &&
            filePaths.some(p => p.includes('server') || p.includes('app.js'))) {
            return {
                type: 'Node.js API', confidence: 0.85,
                description: 'Node.js REST API server',
                characteristics: ['Route handlers', 'Middleware', 'Database models', 'API endpoints'],
            };
        }

        return {
            type: 'Custom', confidence: 0.5,
            description: 'Custom application architecture',
            characteristics: ['Mixed patterns', 'Custom structure'],
        };
    }

    private detectLayers(): ArchitectureLayer[] {
        const layers: ArchitectureLayer[] = [];
        const pyCount = (this.langCounts.python || 0) + (this.langCounts.jupyter || 0);
        const javaCount = this.langCounts.java || 0;
        const tsJsCount = (this.langCounts.typescript || 0) + (this.langCounts.javascript || 0);

        if (pyCount > 0 && pyCount >= tsJsCount) {
            // ── Python layer detection ─────────────────────────────────────
            const group = (patterns: string[]) => this.files.filter(f =>
                patterns.some(p => f.path.toLowerCase().includes(p))
            );

            const modelFiles = group(['models', 'model.py', 'entity', 'schema', 'db/', 'database', 'migration']);
            const viewFiles  = group(['views', 'view.py', 'templates', 'pages', 'frontend', 'ui']);
            const routeFiles = group(['urls', 'routes', 'router', 'api/', 'endpoints', 'handlers']);
            const serviceFiles = group(['services', 'service.py', 'logic', 'business', 'domain']);
            const utilFiles  = group(['utils', 'helpers', 'lib', 'common', 'shared', 'tools']);
            const testFiles  = group(['tests', 'test_', '_test', 'spec_', '_spec', 'conftest']);
            const notebookFiles = this.files.filter(f => f.path.endsWith('.ipynb'));

            if (notebookFiles.length > 0)
                layers.push({ name: 'Notebooks', type: 'presentation', files: notebookFiles.map(f => f.path), description: 'Jupyter notebooks — EDA, modelling, reporting', dependencies: [] });
            if (viewFiles.length > 0)
                layers.push({ name: 'Views / Templates', type: 'presentation', files: viewFiles.map(f => f.path), description: 'View functions, templates, and UI logic', dependencies: ['business'] });
            if (routeFiles.length > 0)
                layers.push({ name: 'Routes / Endpoints', type: 'api', files: routeFiles.map(f => f.path), description: 'URL routing and HTTP endpoint definitions', dependencies: ['business'] });
            if (serviceFiles.length > 0)
                layers.push({ name: 'Services / Business Logic', type: 'business', files: serviceFiles.map(f => f.path), description: 'Domain logic and application services', dependencies: ['data'] });
            if (utilFiles.length > 0)
                layers.push({ name: 'Utilities', type: 'infrastructure', files: utilFiles.map(f => f.path), description: 'Shared helpers and utility functions', dependencies: [] });
            if (modelFiles.length > 0)
                layers.push({ name: 'Models / Data', type: 'data', files: modelFiles.map(f => f.path), description: 'Data models, schemas, and ORM definitions', dependencies: [] });
            if (testFiles.length > 0)
                layers.push({ name: 'Tests', type: 'infrastructure', files: testFiles.map(f => f.path), description: 'Unit and integration test modules', dependencies: [] });

        } else if (javaCount > 0 && javaCount >= tsJsCount) {
            // ── Java layer detection ───────────────────────────────────────
            const group = (patterns: string[]) => this.files.filter(f =>
                patterns.some(p => f.path.toLowerCase().includes(p))
            );

            const controllerFiles = group(['controller', 'rest', 'resource', 'endpoint', 'handler', 'web']);
            const serviceFiles    = group(['service', 'usecase', 'business', 'application', 'facade']);
            const repoFiles       = group(['repository', 'dao', 'persistence', 'jpa', 'mapper']);
            const modelFiles      = group(['model', 'entity', 'domain', 'dto', 'pojo', 'vo']);
            const configFiles     = group(['config', 'configuration', 'security', 'properties']);
            const testFiles       = group(['test', 'spec', 'it']);

            if (controllerFiles.length > 0)
                layers.push({ name: 'Controllers / REST', type: 'presentation', files: controllerFiles.map(f => f.path), description: 'HTTP controllers and request handlers', dependencies: ['business'] });
            if (serviceFiles.length > 0)
                layers.push({ name: 'Services', type: 'business', files: serviceFiles.map(f => f.path), description: 'Business logic and use cases', dependencies: ['data'] });
            if (repoFiles.length > 0)
                layers.push({ name: 'Repositories / DAO', type: 'data', files: repoFiles.map(f => f.path), description: 'Data access objects and repository interfaces', dependencies: [] });
            if (modelFiles.length > 0)
                layers.push({ name: 'Models / Entities', type: 'data', files: modelFiles.map(f => f.path), description: 'Domain entities and data transfer objects', dependencies: [] });
            if (configFiles.length > 0)
                layers.push({ name: 'Configuration', type: 'infrastructure', files: configFiles.map(f => f.path), description: 'Application configuration and security setup', dependencies: [] });
            if (testFiles.length > 0)
                layers.push({ name: 'Tests', type: 'infrastructure', files: testFiles.map(f => f.path), description: 'Unit, integration and e2e tests', dependencies: [] });

        } else {
            // ── TypeScript / JavaScript (original logic) ──────────────────
            const presentationFiles = this.files.filter(f =>
                f.path.includes('component') || f.path.includes('page') || f.path.includes('ui/') ||
                (f.path.endsWith('.tsx') && f.functions.some(fn => fn.name[0] === fn.name[0].toUpperCase()))
            );
            if (presentationFiles.length > 0)
                layers.push({ name: 'Presentation Layer', type: 'presentation', files: presentationFiles.map(f => f.path), description: 'UI components, pages, and user interface logic', dependencies: ['business'] });

            const businessFiles = this.files.filter(f =>
                f.path.includes('lib/') || f.path.includes('utils/') || f.path.includes('services/') || f.path.includes('hooks/') ||
                f.functions.some(fn => fn.name.includes('use') || fn.name.includes('Service'))
            );
            if (businessFiles.length > 0)
                layers.push({ name: 'Business Logic', type: 'business', files: businessFiles.map(f => f.path), description: 'Core business logic, utilities, and services', dependencies: ['data'] });

            const apiFiles = this.files.filter(f =>
                f.path.includes('api/') || f.path.includes('route') ||
                f.functions.some(fn => ['GET', 'POST', 'PUT', 'DELETE'].some(m => fn.name.includes(m)))
            );
            if (apiFiles.length > 0)
                layers.push({ name: 'API Layer', type: 'api', files: apiFiles.map(f => f.path), description: 'API routes, endpoints, and server-side logic', dependencies: ['business'] });

            const dataFiles = this.files.filter(f =>
                f.path.includes('model') || f.path.includes('schema') || f.path.includes('db/') ||
                f.functions.some(fn => fn.name.includes('Model') || fn.name.includes('Schema'))
            );
            if (dataFiles.length > 0)
                layers.push({ name: 'Data Layer', type: 'data', files: dataFiles.map(f => f.path), description: 'Data models, schemas, and database interactions', dependencies: [] });
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

        // Language/framework-specific insight
        const primaryLang = pattern.primaryLanguage;
        if (pattern.type === 'Next.js App' && pattern.confidence > 0.8) {
            insights.push({ type: 'strength', title: 'Modern Next.js Architecture', description: 'Using Next.js App Router for optimal performance and developer experience', severity: 'low' });
        } else if (pattern.type === 'Django') {
            insights.push({ type: 'strength', title: 'Django MTV Architecture', description: 'Well-established MTV pattern with ORM, migrations, and admin built-in', severity: 'low' });
        } else if (pattern.type === 'Flask') {
            insights.push({ type: 'suggestion', title: 'Consider Blueprint Organization', description: 'Flask blueprints can modularize routes as the project grows', severity: 'low' });
        } else if (pattern.type === 'FastAPI') {
            insights.push({ type: 'strength', title: 'FastAPI Async Architecture', description: 'Async-first design with auto-generated OpenAPI documentation and Pydantic validation', severity: 'low' });
        } else if (pattern.type === 'Spring Boot') {
            insights.push({ type: 'strength', title: 'Spring Boot Layered Architecture', description: 'Well-structured Controller → Service → Repository layering with DI', severity: 'low' });
        } else if (pattern.type === 'Data Science') {
            insights.push({ type: 'suggestion', title: 'Consider Notebook-to-Script Refactor', description: 'Extract reusable logic from notebooks into Python modules for better testability and reuse', severity: 'low' });
        }

        // Complexity insights
        const highComplexityComponents = components.filter(c => c.complexity === 'high');
        if (highComplexityComponents.length > 0) {
            insights.push({ type: 'risk', title: 'High Complexity Modules', description: `${highComplexityComponents.length} module${highComplexityComponents.length > 1 ? 's' : ''} have high complexity and may need refactoring`, severity: 'medium', affectedFiles: highComplexityComponents.flatMap(c => c.files) });
        }

        // Layer separation
        if (layers.length >= 3) {
            insights.push({ type: 'strength', title: 'Good Separation of Concerns', description: 'Well-structured layered architecture with clear separation', severity: 'low' });
        }
        const businessLayer = layers.find(l => l.type === 'business');
        const presentationLayer = layers.find(l => l.type === 'presentation');
        if (presentationLayer && !businessLayer) {
            insights.push({ type: 'suggestion', title: 'Consider Business Logic Separation', description: 'Extract domain logic into dedicated service/utility modules for better testability', severity: 'low' });
        }

        // File count
        const highFunctionFiles = this.files.filter(f => f.functions.length > 15);
        if (highFunctionFiles.length > 0) {
            insights.push({ type: 'risk', title: 'Large Files Detected', description: `${highFunctionFiles.length} file${highFunctionFiles.length > 1 ? 's' : ''} contain more than 15 functions — consider splitting`, severity: 'medium', affectedFiles: highFunctionFiles.map(f => f.path) });
        }

        return insights;
    }
}

class CallAnalyzer {
    constructor(private repoPath: string, private sourceFiles: SourceFile[], private importResolver: ImportResolver) {}

    findFunctionCalls(fileNodes: FileNode[]): FunctionCall[] {
        const calls: FunctionCall[] = [];
        
        // Create a map of function names to their files for resolution
        const functionMap = new Map<string, string[]>();
        fileNodes.forEach(file => {
            file.functions.forEach(func => {
                const key = func.name;
                if (!functionMap.has(key)) {
                    functionMap.set(key, []);
                }
                functionMap.get(key)!.push(file.path);
            });
        });
        
        this.sourceFiles.forEach(sourceFile => {
            const filePath = this.getRelativePath(sourceFile, this.repoPath);
            
            // Find all function declarations in this file for caller resolution
            const fileFunctions = new Map<number, string>();
            sourceFile.getFunctions().forEach(func => {
                const name = func.getName() || 'anonymous';
                const start = func.getStartLineNumber();
                const end = func.getEndLineNumber();
                for (let line = start; line <= end; line++) {
                    fileFunctions.set(line, name);
                }
            });
            
            // Also map arrow functions and method functions
            sourceFile.getVariableDeclarations().forEach(varDecl => {
                const initializer = varDecl.getInitializer();
                if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
                    const name = varDecl.getName();
                    const start = varDecl.getStartLineNumber();
                    const end = varDecl.getEndLineNumber();
                    for (let line = start; line <= end; line++) {
                        fileFunctions.set(line, name);
                    }
                }
            });
            
            sourceFile.getClasses().forEach(cls => {
                cls.getMethods().forEach(method => {
                    const name = `${cls.getName()}.${method.getName()}`;
                    const start = method.getStartLineNumber();
                    const end = method.getEndLineNumber();
                    for (let line = start; line <= end; line++) {
                        fileFunctions.set(line, name);
                    }
                });
            });
            
            // Find all function calls
            sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
                const expression = callExpr.getExpression();
                let functionName = '';
                let targetFile: string | null = null;
                
                if (Node.isIdentifier(expression)) {
                    functionName = expression.getText();
                } else if (Node.isPropertyAccessExpression(expression)) {
                    functionName = expression.getName();
                    
                    // Try to resolve the target file for property access calls
                    const objectName = expression.getExpression().getText();
                    targetFile = this.resolveTargetFile(objectName, filePath, fileNodes);
                }
                
                if (functionName) {
                    // Find the caller function
                    const callLine = callExpr.getStartLineNumber();
                    let caller = 'global';
                    
                    // Find the closest containing function
                    for (let line = callLine; line >= 1; line--) {
                        if (fileFunctions.has(line)) {
                            caller = fileFunctions.get(line)!;
                            break;
                        }
                    }
                    
                    // If no target file resolved yet, try to resolve by function name
                    if (!targetFile) {
                        targetFile = this.resolveTargetFile(functionName, filePath, fileNodes);
                        
                        // If still not resolved, check if it's in the same file
                        const fileNode = fileNodes.find(f => f.path === filePath);
                        if (fileNode && fileNode.functions.some(f => f.name === functionName)) {
                            targetFile = filePath;
                        }
                    }
                    
                    calls.push({
                        caller,
                        callerFile: filePath,
                        target: functionName,
                        targetFile,
                        lineNumber: callLine
                    });
                }
            });
        });
        
        return calls;
    }
    
    private resolveTargetFile(identifier: string, currentFilePath: string, fileNodes: FileNode[]): string | null {
        const currentFile = fileNodes.find(f => f.path === currentFilePath);
        if (!currentFile) return null;
        
        // Check if the identifier is an imported symbol
        for (const imp of currentFile.imports) {
            if (imp.importedMembers.includes(identifier) && imp.isResolved && imp.resolved) {
                return imp.resolved;
            }
            
            // Check for default imports
            if (imp.original === identifier && imp.isResolved && imp.resolved) {
                return imp.resolved;
            }
        }
        
        // Check if it's a function in any of the imported files
        for (const imp of currentFile.imports) {
            if (imp.isResolved && imp.resolved) {
                const targetFile = fileNodes.find(f => f.path === imp.resolved);
                if (targetFile && targetFile.functions.some(f => f.name === identifier)) {
                    return imp.resolved;
                }
            }
        }
        
        return null;
    }
    
    private getRelativePath(sourceFile: SourceFile, repoPath: string): string {
        let filePath = sourceFile.getFilePath().replace(repoPath, '');
        if (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
        }
        return filePath.replace(/\\/g, '/');
    }
}

export async function analyzeRepository(repoPath: string): Promise<AnalysisResult> {
    const normalizedRepoPath = repoPath.replace(/\\/g, '/');

    // ── 1. Discover all source files and detect language composition ────────
    const gitignoreExtra = loadGitignorePatterns(normalizedRepoPath);
    const allFiles = walkDir(normalizedRepoPath, gitignoreExtra);
    const langCounts = detectLanguages(allFiles);

    const tsJsCount  = (langCounts.typescript || 0) + (langCounts.javascript || 0);
    const pyCount    = (langCounts.python     || 0) + (langCounts.jupyter    || 0);
    const javaCount  =  langCounts.java       || 0;
    const totalSrcCount = Object.values(langCounts).reduce((a, b) => a + b, 0);

    const fileNodes:    FileNode[]    = [];
    const graphNodes:   GraphNode[]   = [];
    const graphEdges:   GraphEdge[]   = [];
    const codeChunks:   CodeChunk[]   = [];
    let totalFunctions = 0, totalClasses = 0, resolvedImports = 0;
    let functionCalls: FunctionCall[] = [];

    // ── 2. TypeScript / JavaScript via ts-morph ─────────────────────────────
    if (tsJsCount > 0) {
        const { Project, Node: TsNode, SyntaxKind } = await import('ts-morph');
        const project = new Project();
        project.addSourceFilesAtPaths([
            `${normalizedRepoPath}/**/*.{ts,tsx,js,jsx,mjs,cjs}`,
            `!${normalizedRepoPath}/**/node_modules/**`,
            `!${normalizedRepoPath}/**/.next/**`,
            `!${normalizedRepoPath}/**/.git/**`,
            `!${normalizedRepoPath}/**/dist/**`,
            `!${normalizedRepoPath}/**/build/**`,
        ]);
        const sourceFiles = project.getSourceFiles();
        const importResolver  = new ImportResolver(normalizedRepoPath, sourceFiles);
        const functionAnalyzer = new FunctionAnalyzer();
        const callAnalyzer = new CallAnalyzer(normalizedRepoPath, sourceFiles, importResolver);
        const tsFileNodes: FileNode[] = [];

        for (const sourceFile of sourceFiles) {
            let filePath = sourceFile.getFilePath().replace(normalizedRepoPath, '');
            if (filePath.startsWith('/')) filePath = filePath.substring(1);
            filePath = filePath.replace(/\\/g, '/');

            const functions = functionAnalyzer.analyzeFunctions(sourceFile, filePath);
            totalFunctions += functions.length;
            const classes = sourceFile.getClasses().map(c => c.getName() || 'anonymous');
            totalClasses += classes.length;
            const imports = importResolver.resolveAllImports(sourceFile);
            resolvedImports += imports.filter(i => i.isResolved).length;
            const exportNames = Array.from(sourceFile.getExportedDeclarations().keys());
            const fileSize = sourceFile.getFullText().length;
            const fileComplexity = functions.reduce((s, f) => s + f.complexity, 0);
            const summary = generateFileSummary(filePath, functions, classes, exportNames, imports);

            const node: FileNode = { path: filePath, functions, classes, imports, exports: exportNames, complexity: fileComplexity, size: fileSize, summary };
            tsFileNodes.push(node);
            fileNodes.push(node);

            graphNodes.push({ id: filePath, label: path.basename(filePath), type: 'file', group: path.dirname(filePath), complexity: fileComplexity, size: fileSize });
            codeChunks.push({ id: `file:${filePath}`, filePath, content: `File: ${filePath}\nFunctions: ${functions.map(f => f.name).join(', ')}\nImports: ${imports.map(i => i.original).join(', ')}\nExports: ${exportNames.join(', ')}`, lineStart: 1, lineEnd: sourceFile.getEndLineNumber(), type: 'file' });
            functions.forEach(func => {
                codeChunks.push({ id: `${filePath}:${func.name}`, filePath, functionName: func.name, content: `Function: ${func.name}\nParameters: ${func.parameters.join(', ')}\nComplexity: ${func.complexity}\nLines: ${func.startLine}-${func.endLine}`, lineStart: func.startLine, lineEnd: func.endLine, type: 'function' });
            });

            imports.forEach(imp => {
                if (imp.isResolved && imp.resolved) {
                    graphEdges.push({ id: `${filePath}->${imp.resolved}`, source: filePath, target: imp.resolved, type: 'imports', weight: imp.importedMembers.length || 1 });
                } else if (imp.isExternal) {
                    const extId = `external:${imp.original}`;
                    if (!graphNodes.some(n => n.id === extId)) graphNodes.push({ id: extId, label: imp.original, type: 'external' });
                    graphEdges.push({ id: `${filePath}->${extId}`, source: filePath, target: extId, type: 'imports', weight: 1 });
                }
            });
        }

        functionCalls = callAnalyzer.findFunctionCalls(tsFileNodes);
        functionCalls.forEach(call => {
            if (call.targetFile && call.targetFile !== call.callerFile) {
                const edgeId = `call:${call.callerFile}:${call.caller}->${call.targetFile}:${call.target}`;
                if (!graphEdges.some(e => e.id === edgeId)) graphEdges.push({ id: edgeId, source: call.callerFile, target: call.targetFile, type: 'calls', weight: 1 });
            }
        });
    }

    // ── 3. Python files ─────────────────────────────────────────────────────
    if (pyCount > 0) {
        const pyAnalyzer  = new PythonFileAnalyzer();
        const nbAnalyzer  = new JupyterAnalyzer();

        const pyFiles = allFiles.filter(f => f.endsWith('.py') || f.endsWith('.ipynb'));
        for (const absPath of pyFiles) {
            let content = '';
            try { content = fs.readFileSync(absPath, 'utf8'); } catch { continue; }

            const node = absPath.endsWith('.ipynb')
                ? nbAnalyzer.analyzeFile(absPath, content, normalizedRepoPath)
                : pyAnalyzer.analyzeFile(absPath, content, normalizedRepoPath);
            if (!node) continue;

            fileNodes.push(node);
            totalFunctions += node.functions.length;
            totalClasses   += node.classes.length;
            resolvedImports += node.imports.filter(i => i.isResolved).length;

            graphNodes.push({ id: node.path, label: path.basename(node.path), type: 'file', group: path.dirname(node.path), complexity: node.complexity, size: node.size });
            codeChunks.push({ id: `file:${node.path}`, filePath: node.path, content: `File: ${node.path}\nFunctions: ${node.functions.map(f => f.name).join(', ')}\nClasses: ${node.classes.join(', ')}`, lineStart: 1, lineEnd: content.split('\n').length, type: 'file' });
            node.functions.forEach(func => {
                codeChunks.push({ id: `${node.path}:${func.name}`, filePath: node.path, functionName: func.name, content: `Function: ${func.name}\nParameters: ${func.parameters.join(', ')}\nComplexity: ${func.complexity}`, lineStart: func.startLine, lineEnd: func.endLine, type: 'function' });
            });

            node.imports.forEach(imp => {
                if (imp.isResolved && imp.resolved) {
                    const edgeId = `${node.path}->${imp.resolved}`;
                    if (!graphEdges.some(e => e.id === edgeId)) graphEdges.push({ id: edgeId, source: node.path, target: imp.resolved, type: 'imports', weight: imp.importedMembers.length || 1 });
                } else if (imp.isExternal) {
                    const extId = `external:${imp.original}`;
                    if (!graphNodes.some(n => n.id === extId)) graphNodes.push({ id: extId, label: imp.original, type: 'external' });
                    const edgeId = `${node.path}->${extId}`;
                    if (!graphEdges.some(e => e.id === edgeId)) graphEdges.push({ id: edgeId, source: node.path, target: extId, type: 'imports', weight: 1 });
                }
            });
        }
    }

    // ── 4. Java files ───────────────────────────────────────────────────────
    if (javaCount > 0) {
        const javaAnalyzer = new JavaFileAnalyzer();
        const javaFiles = allFiles.filter(f => f.endsWith('.java'));
        for (const absPath of javaFiles) {
            let content = '';
            try { content = fs.readFileSync(absPath, 'utf8'); } catch { continue; }

            const node = javaAnalyzer.analyzeFile(absPath, content, normalizedRepoPath);
            fileNodes.push(node);
            totalFunctions += node.functions.length;
            totalClasses   += node.classes.length;

            graphNodes.push({ id: node.path, label: path.basename(node.path), type: 'file', group: path.dirname(node.path), complexity: node.complexity, size: node.size });
            codeChunks.push({ id: `file:${node.path}`, filePath: node.path, content: `File: ${node.path}\nClasses: ${node.classes.join(', ')}\nMethods: ${node.functions.map(f => f.name).join(', ')}`, lineStart: 1, lineEnd: content.split('\n').length, type: 'file' });
            node.functions.forEach(func => {
                codeChunks.push({ id: `${node.path}:${func.name}`, filePath: node.path, functionName: func.name, content: `Method: ${func.name}\nComplexity: ${func.complexity}`, lineStart: func.startLine, lineEnd: func.endLine, type: 'function' });
            });
        }
    }

    // ── 5. Other languages (Go, Rust, Ruby, C#, PHP, etc.) ─────────────────
    const OTHER_EXTS: Record<string, string> = {
        '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
        '.cs': 'csharp', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
        '.swift': 'swift', '.kt': 'kotlin', '.scala': 'scala',
    };
    const genericAnalyzer = new GenericFileAnalyzer();
    const handledExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.ipynb', '.java']);
    for (const absPath of allFiles) {
        const ext = path.extname(absPath).toLowerCase();
        if (handledExts.has(ext)) continue;
        const language = OTHER_EXTS[ext];
        if (!language) continue;
        let content = '';
        try { content = fs.readFileSync(absPath, 'utf8'); } catch { continue; }
        // Skip very large files (> 500KB)
        if (content.length > 500_000) continue;

        const node = genericAnalyzer.analyzeFile(absPath, content, normalizedRepoPath, language);
        fileNodes.push(node);
        totalFunctions += node.functions.length;
        totalClasses   += node.classes.length;

        graphNodes.push({ id: node.path, label: path.basename(node.path), type: 'file', group: path.dirname(node.path), complexity: node.complexity, size: node.size });
        codeChunks.push({ id: `file:${node.path}`, filePath: node.path, content: `File: ${node.path}\nFunctions: ${node.functions.map(f => f.name).join(', ')}\nClasses: ${node.classes.join(', ')}`, lineStart: 1, lineEnd: content.split('\n').length, type: 'file' });
    }

    // ── 6. Architecture detection ───────────────────────────────────────────
    const architectureDetector = new ArchitectureDetector(fileNodes, normalizedRepoPath, langCounts);
    const architecture = architectureDetector.detectArchitecture();

    return {
        metrics: {
            files: fileNodes.length,
            functions: totalFunctions,
            classes: totalClasses,
            dependencies: graphEdges.filter(e => e.type === 'imports').length,
            resolvedImports,
            functionCalls: functionCalls.length,
        },
        files: fileNodes,
        graph: { nodes: graphNodes, edges: graphEdges },
        functionCalls,
        codeChunks,
        architecture,
    };
}