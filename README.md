# Gawkyy — Generic Application Wrapper (GAW)

[![License: GPL v2](https://img.shields.io/badge/License-GPLv2-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WebAssembly-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![PWA](https://img.shields.io/badge/PWA-100%25%20Offline-5A0FC8.svg?logo=pwa&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![GitHub Repository](https://img.shields.io/badge/GitHub-davidgma%2Fgeneric--application--wrapper-181717.svg?logo=github&logoColor=white)](https://github.com/davidgma/generic-application-wrapper)
[![Google AI Studio](https://img.shields.io/badge/Google%20AI%20Studio-Project-4285F4.svg?logo=google&logoColor=white)](https://aistudio.google.com/)

> **Gawkyy** is an offline-first, web-native personal and business application platform designed as a modern, cross-platform successor to Microsoft Access. Built on WebAssembly SQLite, in-browser Sucrase TSX compilation, reactive Excel-compatible spreadsheets, and automated 4-way delta conflict reconciliation.

---

## 🌟 Key Highlights

- **Single-File Portability**: All your data—relational schema, user records, saved queries, visual reports, and even dynamic React TSX plugins—lives in a single portable `.sqlite` file.
- **100% Client-Side & Offline Ready**: Executes SQLite natively in your browser via [sql.js](https://sql.js.org/) (WebAssembly). Zero mandatory server dependencies, complete privacy, and full offline operation via Progressive Web App (PWA) standards.
- **Independent Local & Cloud Sync**:
  - **Local Disk Sync**: Leverages the PWA [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to maintain continuous read-write access to your local SQLite file without locking it, permitting simultaneous external access.
  - **Dropbox Cloud Sync**: Synchronize across laptops, phones, and tablets with Dropbox OAuth 2.0 PKCE authentication.
  - **4-Way Conflict Reconciliation**: Automated delta-state evaluation across 4 conditions (unmodified, internal-only change, external-only change, and concurrent dual changes) with automatic structural merging and user conflict protection.
  - **Customizable Intervals**: Toggle auto-sync on/off independently for local disk and cloud storage, with standard presets (5s, 10s, 30s, 1m, 5m) or user-specified custom second intervals persisted across browser sessions.
- **Dynamic TSX Plugin Engine**: Build custom applications directly inside SQLite (`t_plugins`). Dynamic plugins are written in React TSX, transpiled in milliseconds via [Sucrase](https://sucrase.io/), and safely isolated inside React Error Boundaries (Plugin Safe Mode).
- **Embedded Monaco IDE**: Full Visual Studio Code editor experience inside the browser with syntax highlighting, TypeScript autocompletion, Prettier auto-formatting, SQL scratchpad, and a dedicated Full-Screen Studio Mode (`Ctrl + Shift + F`).
- **Spreadsheet Studio**: Excel-compatible calculation grid supporting formulas (`=SUM`, `=AVERAGE`, `=COUNT`, `=MIN`, `=MAX`, `=IF`, arithmetic), multi-sheet workbooks, CSV export, and bi-directional SQL table pushing.
- **Visual Report Generator**: Connect SQL queries to publication-grade executive reports with KPI summary scorecards, multi-column aggregation tables, charts, and clean print/PDF layouts.

---

## 🛠️ Technology Stack & Official References

| Technology | Role | Documentation |
| :--- | :--- | :--- |
| **TypeScript** | Primary programming language | [typescriptlang.org](https://www.typescriptlang.org/) |
| **React 19** | Declarative component UI & plugin host | [react.dev](https://react.dev/) |
| **SQLite** | Core relational database engine | [sqlite.org](https://www.sqlite.org/) |
| **sql.js** | WebAssembly SQLite compilation runtime | [sql.js.org](https://sql.js.org/) |
| **Progressive Web App (PWA)** | Offline caching & installability | [MDN PWA Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) |
| **File System Access API** | Lock-free local disk read-write access | [MDN File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) |
| **Dropbox API** | Cloud storage & multi-device sync | [dropbox.com/developers](https://www.dropbox.com/developers) & [App Console](https://www.dropbox.com/developers/apps) |
| **HTML5 & Web APIs** | Semantic layout, drag-and-drop, IndexedDB | [MDN HTML5 Docs](https://developer.mozilla.org/en-US/docs/Web/HTML) |
| **CSS3 & Tailwind CSS** | High-density styling & theme design | [tailwindcss.com](https://tailwindcss.com/) & [MDN CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS) |
| **JavaScript (ES2022+)** | Web standards, async/await, typed arrays | [MDN JavaScript Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript) |
| **Monaco Editor** | Visual Studio Code in-browser IDE | [microsoft.github.io/monaco-editor](https://microsoft.github.io/monaco-editor/) |
| **Sucrase** | Fast client-side JSX/TSX transpiler | [sucrase.io](https://sucrase.io/) |
| **Lucide Icons** | SVG iconography | [lucide.dev](https://lucide.dev/) |
| **Vite** | Modern frontend bundle & development server | [vitejs.dev](https://vitejs.dev/) |
| **Google AI Studio** | Application conception & engineering platform | [aistudio.google.com](https://aistudio.google.com/) |
| **GitHub Repository** | Public source code repository | [github.com/davidgma/generic-application-wrapper](https://github.com/davidgma/generic-application-wrapper) |

---

## 🚀 Getting Started Developing An App Using Gawkky

You can start designing and running your own database applications immediately in your browser—no command line or build tools required:

1. **Launch Gawkyy**: Open the live application at [**gawkky.freshfood.rocks**](https://gawkky.freshfood.rocks).
2. **Access the Application User Guide**:
   - Click the **Help** (`?`) icon in the top navigation bar or select **Help & System Guide** from the left navigation drawer.
   - Click the **Application User Guide** tab at the top of the Help screen.
   - Here you will find in-depth operational manuals covering:
     - **Database Studio & Table Editor**: Designing relational tables, editing data inline, and executing raw SQL queries.
     - **Visual Report Generator & Executive Designer**: Creating publication-grade reports with KPI summary scorecards, SVG charts, aggregation tables, and clean PDF exports.
     - **Spreadsheet Studio**: Using the reactive Excel-compatible formula grid (`=SUM`, `=AVERAGE`, `=COUNT`, `=IF`) and pushing datasets to and from SQLite.
     - **File Storage & 4-Way Auto-Sync Reconciliation**: Configuring lock-free local disk sync via the File System Access API and multi-device Dropbox cloud synchronization with automated conflict resolution.
3. **Start Building**:
   - Create tables, import CSV data, write queries, or click **Add Plugin** to develop interactive custom micro-apps directly within your `.sqlite` file.

---

## 💻 Developing Gawkyy itself

Gawkyy can be developed and extended in two ways: through **Google AI Studio** using AI prompt-assisted vibe coding, or locally on your machine via standard TypeScript / Vite tooling.

### 🤖 Developing via Google AI Studio (Vibe Coding)

Gawkyy was created and engineered using Google AI Studio. You can inspect, fork, or clone this exact project to build your own custom features through conversational AI prompts and vibe coding:

- **AI Studio Project Link**: [https://aistudio.google.com/apps/2e169a2f-c69d-4d82-846b-143256ba31f5](https://aistudio.google.com/apps/2e169a2f-c69d-4d82-846b-143256ba31f5)
- Open the link above in Google AI Studio to clone the workspace.
- Use natural language prompts to describe new features, custom plugins, UI enhancements, or storage connectors, and AI Studio will update and build the code in real time.

### 🖥️ Local TypeScript / Vite Development

#### Prerequisites
- Node.js (v18 or higher)
- npm, pnpm, or bun

#### Local Setup

```bash
# 1. Clone the public repository
git clone https://github.com/davidgma/generic-application-wrapper.git
cd generic-application-wrapper

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open your browser at `http://localhost:3000`.

#### Production Build & PWA Generation

```bash
# Build the production bundle and generate service workers
npm run build

# Preview the production build locally
npm run preview
```

---

## 🧩 Plugin Developer Guide

In Gawkyy, plugins are first-class applications stored directly within the active SQLite database in the `t_plugins` table. Plugins receive a powerful global `gaw` context object providing access to database queries, UI dialogs, notifications, themes, navigation, and storage APIs.

### Starter Plugin Boilerplate

```tsx
import React, { useState, useEffect } from 'react';
import { Database, Sparkles, RefreshCw } from 'lucide-react';

export default function MyCustomPlugin({ gaw }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    try {
      setLoading(true);
      // Query SQLite database records as JavaScript objects
      const result = gaw.db.queryObjects('SELECT * FROM t_settings LIMIT 20;');
      setRows(result || []);
      gaw.toast.success(`Loaded ${result?.length || 0} records from SQLite!`);
    } catch (err) {
      gaw.toast.error(`Query error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-900 border-slate-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span>My Custom SQLite Plugin</span>
        </h2>
        <button
          onClick={loadData}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="border rounded-xl p-4 bg-slate-950/70 border-slate-800 text-xs text-slate-300 font-mono">
        <pre>{JSON.stringify(rows, null, 2)}</pre>
      </div>
    </div>
  );
}
```

### The `gaw` Context Object Reference

| API Method | Description |
| :--- | :--- |
| `gaw.db.query(sql, params)` | Executes SQL and returns `{ columns: string[], values: any[][] }`. |
| `gaw.db.queryObjects(sql, params)` | Executes SQL and returns an array of JavaScript objects `[ { id: 1, ... } ]`. |
| `gaw.db.execute(sql)` | Executes multi-statement DDL/DML scripts and notifies subscribers of mutations. |
| `gaw.db.getTables()` | Returns an array of user table names in the active SQLite database. |
| `gaw.db.getSchema()` | Returns column definitions, data types, primary keys, and nullability flags. |
| `gaw.toast.success(msg)` / `.error` / `.warning` / `.info` | Triggers floating notification toasts. |
| `gaw.dialog.confirm(message)` | Asynchronous confirm dialog returning `Promise<boolean>`. |
| `gaw.dialog.prompt(message, defaultValue)` | Asynchronous text input dialog returning `Promise<string \| null>`. |
| `gaw.navigation.navigate(route)` | Switches views (e.g. `'file'`, `'view'`, `'database'`, `'plugins'`, `'ide'`). |
| `gaw.navigation.openSpreadsheet(data, name)` | Pipes any dataset directly into a new Spreadsheet Studio tab. |
| `gaw.navigation.openIDE(tabInfo)` | Opens the Monaco IDE focused on a specific plugin or SQL query. |
| `gaw.navigation.openAI()` | Opens the AI Specification Generator prompt modal. |
| `gaw.storage.save()` / `.saveAs()` | Saves database to disk using File System Access API without locks. |
| `gaw.dropbox.save()` / `.saveAs()` | Saves active database directly to the user's connected Dropbox cloud account. |
| `gaw.eventBus.on(event, callback)` / `.emit(event, ...args)` | Inter-plugin and system event pub/sub communication bus. |
| `gaw.theme` | Current theme (`'vs-dark'` or `'vs-light'`). |

---

## 🔄 4-Way Auto-Sync & Delta Reconciliation

Gawkyy provides independent local disk and Dropbox cloud synchronization. When auto-sync is active, each sync tick performs a non-blocking check across four state conditions:

1. **Condition 1 (Neither changed)**: Internal tally is clean and external file timestamp/hash is identical. No action taken.
2. **Condition 2 (Internal changed, external unchanged)**: The user modified records or schema locally; external target is untouched since last sync. Gawkyy writes the current database to the destination and updates sync timestamps.
3. **Condition 3 (External changed, internal unchanged)**: Another device or process updated the file on disk or Dropbox while this app session remained idle. Gawkyy reloads the external database into SQLite memory.
4. **Condition 4 (Both changed concurrently)**: Both local SQLite memory and the external destination have changes since the last sync. Gawkyy executes an automatic structural reconciliation algorithm to merge non-conflicting tables and records. If an unresolvable collision occurs, a conflict dialog prompts the user to keep internal, reload external, or save as a separate copy.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Description |
| :--- | :--- |
| `Ctrl + Shift + F` | Toggle Full Monaco Studio Mode / Gawkyy Shell |
| `Ctrl + O` | Open Local SQLite Database File |
| `Ctrl + S` | Save Active Database to Local Disk / Cloud |
| `Ctrl + Enter` | Run SQL Query / Test Active Plugin in Monaco IDE |
| `Shift + Alt + F` | Format Document with Prettier |
| `Ctrl + B` | Toggle Navigation Sidebar |

---

## 📄 License

This program is free software; you can redistribute it and/or modify it under the terms of the **GNU General Public License version 2 (GPLv2)** as published by the Free Software Foundation.

See the [LICENSE](./LICENSE) file for complete license text.
