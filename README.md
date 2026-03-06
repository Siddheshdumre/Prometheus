<div align="center">

# 🔥 Prometheus

### **Codebase Intelligence Platform**

*Drop in any GitHub repo. Get instant architecture maps, AI-powered explanations, impact analysis, and deep code exploration — in seconds.*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/Gemini_2.5-Flash-orange?logo=google)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

<br/>

<img src="https://img.shields.io/badge/10%2B_Languages-Supported-cyan" alt="Languages"/>
<img src="https://img.shields.io/badge/20%2B_Architecture_Patterns-Detected-violet" alt="Patterns"/>
<img src="https://img.shields.io/badge/AST_Powered-Analysis-yellow" alt="AST"/>

</div>

---

## 🤔 The Problem

You just joined a new team. Or you're reviewing a PR from an open-source repo you've never seen. Or you inherited a legacy codebase with zero documentation.

You stare at the folder structure and ask yourself:

> *"What does this app even do? Where does the data flow? What breaks if I touch this file?"*

Conventional approaches — reading every file, tracing imports manually, asking teammates — take **hours or days**.

## 💡 The Solution

**Prometheus** analyzes any repository in seconds and gives you:

| What you get | Why it matters |
|---|---|
| 🏗 **Architecture Detection** | Instantly know if it's a Next.js app, Django API, Spring Boot service, or one of 20+ patterns |
| 🤖 **AI Codebase Explanation** | A full markdown document explaining the project, tech stack, data flow, and key files — streamed live |
| 💥 **Impact Analysis** | "What breaks if I change `auth.ts`?" — with risk scores and dependency chains |
| 📁 **Annotated Project Tree** | Every file and folder annotated with function counts, complexity, and architectural role |
| 🔍 **Code Explorer** | Monaco Editor (VS Code engine) with syntax highlighting + file analysis panels |
| 💬 **AI Chat** | Ask questions about the codebase and get answers grounded in actual code context |
| ⌨️ **Command Palette** | `Ctrl+K` to search files, functions, or fire AI queries — instantly |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- A **Google Gemini API key** ([get one free](https://aistudio.google.com/apikey))

### Setup

```bash
# Clone it
git clone https://github.com/your-username/prometheus.git
cd prometheus

# Install dependencies
npm install

# Add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Launch
npm run dev
```

Open **http://localhost:3000** → Paste any GitHub URL → Hit **Analyze**.

That's it. No config files. No database. No Docker.

---

## 🖥️ Features In Depth

### 📊 Dashboard

The home screen. Paste a GitHub URL (e.g., `https://github.com/vercel/next.js`) or a local path, and Prometheus will:

1. **Download** the repo (tarball via GitHub API — no `git` binary needed)
2. **Analyze** every file across 10+ languages
3. **Detect** the architecture pattern, layers, and components
4. **Generate** a full AI-powered codebase overview (streamed word-by-word)

You see real-time metrics: file count, functions, classes, dependency resolution rate, and cross-file call count.

The AI overview covers:
- 📋 Project Summary
- 🛠 Tech Stack
- 🏗 Architecture Overview
- 📁 Key Files & What They Do
- 🔄 Data Flow
- 📦 External Dependencies
- ⚡ Patterns & Conventions
- 🔍 Observations & Recommendations

> Every section references **actual file names and functions** from the analysis — not generic filler.

---

### 🏗 Architecture View

A multi-panel architecture dashboard featuring:

| Panel | What it shows |
|---|---|
| **Layer Stack** | Interactive vertical diagram of architectural layers (Presentation → Business → API → Data). Expand to see files, complexity per layer, and cross-layer dependency arrows. |
| **Dependency Graph** | SVG circle-layout of directory-level imports. Nodes sized by file count, colored by complexity. Hover to isolate connections. |
| **Complexity Treemap** | Files as colored chips grouped by directory. Green (low) → Red (high complexity). Hover for detailed stats. |
| **Coupling Matrix** | NxN grid of the top 9 most-imported files. Cyan = one-way dependency, violet = mutual coupling. |
| **Key Components** | Top modules ranked by connection count with type classification (page, service, utility, API route). |
| **Insights** | Auto-generated strengths (green), risks (red), suggestions (blue), and warnings (yellow) with explanations. |

---

### 📁 Project Structure

An annotated working tree — like the output of `tree` but smarter:

```
├── src/
│   ├── app/                    # Presentation — UI routing (12 files)
│   │   ├── layout.tsx          # 2 exported fns, 45 lines
│   │   ├── page.tsx            # 1 exported fn, complexity 8, 120 lines
│   │   └── auth.guard.ts       # 3 exported fns, 1 class, 89 lines
│   ├── components/             # Presentation — Shared components (24 files)
│   ├── services/               # Business Logic — API integration (8 files)
│   └── utils/                  # Infrastructure — Helpers (5 files)
```

- **Directories** show file counts and architecture-layer descriptions
- **Files** show exported function count, class count, complexity score, and line count
- Filter/search, expand all, collapse all
- Language-specific file icons with color coding

---

### 💥 Impact Analyzer

Select any file or function and ask: **"What breaks if I change this?"**

Prometheus runs a BFS traversal through the reverse-dependency graph (up to depth 5) and returns:

- **Risk Score** — computed from direct importers, transitive dependents, complexity, export count, and file role (shared lib? config file?)
- **Risk Level** — HIGH / MEDIUM / LOW with color-coded badge
- **Direct Impacts** — files that directly import the target, with break/risky/safe classification
- **Indirect Impacts** — transitive dependents with depth indicators
- **Risk Factors** — human-readable explanations ("5 files directly import this", "Shared library / utility file")

---

### 💬 AI Chat

A conversational interface powered by **Gemini 2.5 Flash**. Ask anything about the codebase:

- *"How does authentication work in this project?"*
- *"What's the most complex file and why?"*
- *"Explain the data flow from the login page to the database."*

Responses are grounded in **actual code** — Prometheus uses RAG-style context injection, sending the 6 most relevant code chunks alongside your question.

---

### 🔍 Code Explorer

A two-panel view:

- **Left:** File tree with complexity badges (color-coded) and function counts
- **Right:** Full **Monaco Editor** (the engine behind VS Code) with:
  - Read-only syntax highlighting for 15+ languages
  - Minimap, line numbers, code folding
  - File analysis panel below: functions list, imports (resolved ✓ / external), exports

---

### ⌨️ Command Palette

Press `Ctrl+K` (or `⌘K` on Mac) anywhere to open a fuzzy search overlay:

- Search **files** by path
- Search **functions** by name across the entire repo
- Ask **AI questions** (auto-detected from natural language)
- Navigate to any tab instantly

---

## 🔬 Analysis Engine

The core of Prometheus. A multi-language static analysis engine that extracts structure from source code.

### Language Support

| Language | Analysis Method | What's Extracted |
|---|---|---|
| **TypeScript / JavaScript** | AST via `ts-morph` | Functions, classes, imports (with full path resolution + `@/` alias + tsconfig paths), exports, cyclomatic complexity, call graph |
| **Python** | Regex + structural | `def`/`async def`, classes, `import`/`from...import`, `__all__` exports, relative imports, complexity |
| **Jupyter Notebooks** | JSON parse → Python analysis | Code cells extracted and analyzed as Python |
| **Java** | Regex | Methods (with visibility), classes/interfaces/enums, imports, complexity |
| **Go** | Regex | `func` declarations, `import` blocks, `type struct/interface` |
| **Rust** | Regex | `fn`, `use`, `struct/enum/trait/impl`, `pub` exports |
| **Ruby** | Regex | `def`/`class`/`module`, `require`/`require_relative` |
| **PHP, C#, Kotlin, Scala, Swift** | Generic regex | Functions, classes, imports |

### Architecture Detection

Prometheus identifies **20+ architecture patterns** automatically:

`Next.js App` · `React SPA` · `Node.js API` · `Django` · `Flask` · `FastAPI` · `Data Science` · `Python Package` · `Spring Boot` · `Java Maven` · `Android` · `Go Module` · `Rust Crate` · `Ruby on Rails` · `Component-Service` · `Layered` · `Micro-Frontend` · and more

Detection uses heuristics on file paths, marker files (e.g., `manage.py` for Django, `build.gradle` for Android), and content scanning (e.g., `@SpringBootApplication` annotation in Java files).

---

## 🌐 Deploy on Vercel

Prometheus deploys to Vercel with zero config:

```bash
npm i -g vercel
vercel
```

Set the environment variable in your Vercel dashboard:

```
GEMINI_API_KEY=your_key_here
```

> No `git` binary required on the server — Prometheus downloads repos via GitHub's tarball API and extracts them with a custom pure-Node.js tar parser.

### CI/CD with GitHub Actions

The included workflow at `.github/workflows/ci-cd.yml`:

- **CI** on PR and push to `main`: install → type-check → lint → build
- **CD** on push to `main`: auto-deploys to Vercel (if secrets are set)

Required repository secrets:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.5 |
| **Styling** | Tailwind CSS |
| **Code Editor** | Monaco Editor (VS Code engine) |
| **AI** | Google Gemini 2.5 Flash via `@google/genai` |
| **AST Parsing** | ts-morph (TypeScript Compiler API) |
| **Icons** | Lucide React |
| **Hotkeys** | react-hotkeys-hook |

---

## 📂 Project Structure

```
prometheus/
├── app/
│   ├── page.tsx                    # Entry point
│   ├── layout.tsx                  # Root layout
│   └── api/
│       ├── chat/route.ts           # AI chat endpoint (streaming + non-streaming)
│       ├── repo/analyze/route.ts   # Repo analysis endpoint (GitHub download + analysis)
│       └── file/content/route.ts   # File content reader (with path traversal protection)
├── components/
│   ├── workspace.tsx               # Main workspace shell (all tabs)
│   ├── architecture-overview.tsx   # Multi-panel architecture dashboard
│   ├── project-tree.tsx            # Annotated working tree
│   ├── impact-analysis.tsx         # Change impact analyzer
│   ├── file-tree.tsx               # File explorer sidebar
│   ├── code-viewer.tsx             # Monaco code viewer + analysis panel
│   ├── command-palette.tsx         # Ctrl+K fuzzy search overlay
│   └── markdown-renderer.tsx       # AI output renderer with styled sections
├── lib/
│   └── analyzer.ts                 # Multi-language static analysis engine
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🔒 Security

- **Path traversal protection** on all file-read APIs (resolved path must be within repo directory)
- **Input validation** on all API routes
- **No credentials stored** — API key is server-side only via environment variable
- **Temp directory cleanup** — downloaded repos are always deleted after analysis

---

## 🗺️ Roadmap

- [ ] **Git diff analysis** — Analyze specific commits or PRs
- [ ] **Multi-repo comparison** — Compare architecture patterns across repos
- [ ] **Custom rules engine** — Define your own architecture rules and lint checks
- [ ] **Export reports** — PDF/HTML export of analysis results
- [ ] **Team collaboration** — Share analysis results with your team
- [ ] **VS Code extension** — Run Prometheus directly in your editor

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
# Fork and clone
git clone https://github.com/your-username/prometheus.git
cd prometheus
npm install

# Create a branch
git checkout -b feature/your-feature

# Make changes and verify
npx tsc --noEmit
npm run lint
npm run build

# Open a PR
```

---

## 📄 License

MIT — use it however you want.

---

<div align="center">

**Built for developers who'd rather understand code than stare at it.**

*Star ⭐ this repo if Prometheus saved you time.*

</div>
