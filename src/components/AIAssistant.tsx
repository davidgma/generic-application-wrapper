import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Sparkles,
  Download,
  Code2,
  Database,
  Layers,
  FileCode,
  X,
  Play,
  PlusCircle,
} from 'lucide-react';
import { SQLiteEngine } from '../engine/sqliteEngine';
import { GAW_TYPES_DECLARATION } from './IDE/gawTypesDeclaration';

interface AIAssistantProps {
  onClose: () => void;
  onInstallPlugin: (plugin: {
    id: string;
    name: string;
    description: string;
    code: string;
    icon: string;
    menu_category: string;
    route: string;
  }) => void;
  theme?: 'vs-dark' | 'vs-light';
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  onClose,
  onInstallPlugin,
  theme = 'vs-dark',
}) => {
  const engine = SQLiteEngine.getInstance();
  const [activeTab, setActiveTab] = useState<'prompt' | 'templates' | 'gemini'>('prompt');
  const [copied, setCopied] = useState(false);
  const [customGoal, setCustomGoal] = useState(
    'Build an interactive Order Processing and Invoice Dispatch dashboard with status filtering and one-click shipping status updates.'
  );

  // Extract live database schema & sample rows
  const schemaDetails = useMemo(() => {
    const schemas = engine.getSchema();
    return schemas.map((table) => {
      let sampleRows: any[] = [];
      try {
        const res = engine.query(`SELECT * FROM "${table.name}" LIMIT 2;`);
        sampleRows = res.values.map((row) => {
          const obj: any = {};
          res.columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      } catch (e) {
        // ignore
      }

      return {
        table: table.name,
        type: table.type,
        rowCount: table.rowCount,
        columns: table.columns.map((c) => ({
          name: c.name,
          type: c.type,
          isPrimary: c.pk === 1,
        })),
        sampleRows,
      };
    });
  }, [engine]);

  // Generate tailored AI Prompt
  const generatedPrompt = useMemo(() => {
    const schemaText = JSON.stringify(schemaDetails, null, 2);

    return `You are an expert React and TypeScript engineer writing a dynamic runtime plugin for GAW (Generic Application Wrapper) — a modern, web-native MS Access in the browser powered by in-browser SQLite (sql.js).

### OBJECTIVE
${customGoal}

### HOST ENVIRONMENT & RUNTIME ARCHITECTURE
- The plugin code is written in TypeScript / TSX and compiled in-browser at runtime using Sucrase.
- Standard React hooks (useState, useEffect, useMemo, useCallback, useRef) and Lucide icons (from lucide-react) are available in scope.
- The plugin MUST export a default React component taking a single prop \`{ gaw }\`:
  \`export default function MyPlugin({ gaw }: { gaw: GAWContext }) { ... }\`

### GAW PLUGIN API TYPES & INTERFACES
\`\`\`typescript
${GAW_TYPES_DECLARATION.trim()}
\`\`\`

### ACTIVE SQLITE DATABASE SCHEMA & SAMPLE DATA
The following tables and data currently exist in the user's active SQLite database:
\`\`\`json
${schemaText}
\`\`\`

### IMPLEMENTATION GUIDELINES
1. All data queries and mutations MUST use \`gaw.db.queryObjects(sql, params)\` or \`gaw.db.run(sql, params)\`.
2. When performing INSERT/UPDATE/DELETE mutations, call \`gaw.eventBus.emit('db_changed')\` and display feedback with \`gaw.toast.success(...)\`.
3. Subscribe to database changes using \`gaw.eventBus.on('db_changed', reloadData)\` in a \`useEffect\` hook.
4. Style the component cleanly using Tailwind CSS utility classes (dark mode theme: bg-slate-900, text-slate-100, border-slate-800, accent: indigo/emerald).
5. Output ONLY the self-contained TSX code inside a standard typescript codeblock.`;
  }, [customGoal, schemaDetails]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Ready-to-install curated templates
  const templates = [
    {
      id: 'template_kanban',
      name: 'Order Pipeline Kanban Board',
      category: 'Operations',
      icon: 'Layers',
      description: 'Interactive visual workflow columns (Pending, Processing, Shipped, Completed) with drag/move actions that update SQLite status in real time.',
      code: `import React, { useState, useEffect } from 'react';

export default function OrderKanbanPlugin({ gaw }) {
  const [orders, setOrders] = useState([]);
  const statuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'COMPLETED'];

  const loadOrders = () => {
    try {
      const data = gaw.db.queryObjects(
        'SELECT o.id, c.company_name, o.ship_country, o.total_amount, o.status, o.order_date ' +
        'FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY o.order_date DESC'
      );
      setOrders(data);
    } catch (e) {
      gaw.toast.error('Failed to load orders: ' + e.message);
    }
  };

  useEffect(() => {
    loadOrders();
    const unsub = gaw.eventBus.on('db_changed', loadOrders);
    return unsub;
  }, []);

  const moveOrder = (orderId, newStatus) => {
    try {
      gaw.db.run('UPDATE orders SET status = ? WHERE id = ?', [newStatus, orderId]);
      gaw.toast.success('Order ' + orderId + ' moved to ' + newStatus);
      loadOrders();
      gaw.eventBus.emit('db_changed');
    } catch (e) {
      gaw.toast.error('Update failed: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-hidden">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">Order Pipeline Kanban Board</h1>
          <p className="text-xs text-slate-400">Move orders between lifecycle stages directly in SQLite.</p>
        </div>
        <button
          onClick={() => gaw.navigation.openQuery('SELECT * FROM orders;')}
          className="px-3 py-1.5 rounded bg-slate-800 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-700"
        >
          View Raw Orders
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 overflow-hidden min-h-0">
        {statuses.map(st => {
          const colOrders = orders.filter(o => o.status === st);
          return (
            <div key={st} className="flex flex-col bg-slate-950/70 border border-slate-800 rounded-xl p-3 overflow-hidden">
              <div className="flex justify-between items-center pb-2 mb-3 border-b border-slate-800/80">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{st}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-mono text-indigo-400 font-bold">
                  {colOrders.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {colOrders.map(ord => (
                  <div key={ord.id} className="p-3 bg-slate-800/90 rounded-lg border border-slate-700 shadow-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-bold text-indigo-300">{ord.id}</span>
                      <span className="font-mono text-xs text-emerald-400 font-semibold">\${Number(ord.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="text-xs font-medium text-white truncate">{ord.company_name}</div>
                    <div className="text-[11px] text-slate-400">{ord.ship_country} • {ord.order_date}</div>

                    <div className="pt-2 border-t border-slate-700/60 flex flex-wrap gap-1">
                      {statuses.filter(s => s !== st).map(nextSt => (
                        <button
                          key={nextSt}
                          onClick={() => moveOrder(ord.id, nextSt)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 hover:bg-indigo-600 text-slate-200 transition"
                        >
                          → {nextSt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}`,
    },
    {
      id: 'template_pricing',
      name: 'Dynamic Margin & Discount Simulator',
      category: 'Commercial',
      icon: 'Percent',
      description: 'Model wholesale price adjustments and bulk margins across catalog categories before executing batch SQL updates.',
      code: `import React, { useState, useEffect } from 'react';

export default function PricingSimulatorPlugin({ gaw }) {
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [discountPct, setDiscountPct] = useState(10);
  const [products, setProducts] = useState([]);

  const loadData = () => {
    try {
      const cats = gaw.db.queryObjects('SELECT * FROM categories');
      setCategories(cats);
      const prods = gaw.db.queryObjects(
        'SELECT p.id, p.name, c.name as category, p.unit_price, p.units_in_stock ' +
        'FROM products p JOIN categories c ON p.category_id = c.id'
      );
      setProducts(prods);
    } catch (e) {
      gaw.toast.error(e.message);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = gaw.eventBus.on('db_changed', loadData);
    return unsub;
  }, []);

  const handleApplyDiscount = async () => {
    const ok = await gaw.dialog.confirm(
      'Apply ' + discountPct + '% price change across category: ' + selectedCat + '?'
    );
    if (!ok) return;

    try {
      const factor = 1 - (discountPct / 100);
      if (selectedCat === 'ALL') {
        gaw.db.run('UPDATE products SET unit_price = ROUND(unit_price * ?, 2)', [factor]);
      } else {
        const catObj = categories.find(c => c.name === selectedCat);
        if (catObj) {
          gaw.db.run('UPDATE products SET unit_price = ROUND(unit_price * ?, 2) WHERE category_id = ?', [factor, catObj.id]);
        }
      }
      gaw.toast.success('Prices updated in SQLite successfully!');
      loadData();
      gaw.eventBus.emit('db_changed');
    } catch (e) {
      gaw.toast.error('Pricing update failed: ' + e.message);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 h-full flex flex-col overflow-hidden">
      <h1 className="text-xl font-bold text-white mb-1">Dynamic Margin & Discount Simulator</h1>
      <p className="text-xs text-slate-400 mb-6">Simulate and write wholesale margin adjustments back to SQLite.</p>

      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center gap-6 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Target Category</label>
          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Discount %: {discountPct}%</label>
          <input
            type="range"
            min="-50"
            max="50"
            value={discountPct}
            onChange={e => setDiscountPct(Number(e.target.value))}
            className="accent-indigo-500"
          />
        </div>

        <button
          onClick={handleApplyDiscount}
          className="ml-auto px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow"
        >
          Execute Pricing Update to Database
        </button>
      </div>

      <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800 text-slate-300 sticky top-0">
            <tr>
              <th className="p-2.5">Product</th>
              <th className="p-2.5">Category</th>
              <th className="p-2.5">Current Price</th>
              <th className="p-2.5">Simulated Price</th>
              <th className="p-2.5">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {products.filter(p => selectedCat === 'ALL' || p.category === selectedCat).map(p => {
              const simPrice = Math.round(p.unit_price * (1 - discountPct / 100) * 100) / 100;
              const diff = simPrice - p.unit_price;
              return (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-medium text-white">{p.name}</td>
                  <td className="p-2.5 text-slate-400">{p.category}</td>
                  <td className="p-2.5 font-mono">\${p.unit_price.toFixed(2)}</td>
                  <td className="p-2.5 font-mono text-emerald-400 font-bold">\${simPrice.toFixed(2)}</td>
                  <td className="p-2.5 font-mono text-xs">
                    <span className={diff < 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {diff < 0 ? '-' : '+'}\${Math.abs(diff).toFixed(2)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-bold text-white">AI Specification & Plugin Generator</h2>
              <p className="text-xs text-slate-400">
                Export schema-aware prompts for Gemini / Claude / ChatGPT or install instant templates.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 pt-3 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-3 py-1.5 font-semibold rounded-t border-b-2 transition ${
              activeTab === 'prompt'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Prompt Exporter
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-3 py-1.5 font-semibold rounded-t border-b-2 transition ${
              activeTab === 'templates'
                ? 'border-indigo-500 text-white bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Curated Plugin Library ({templates.length})
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto py-4">
          {activeTab === 'prompt' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  1. Customize What Plugin You Want to Generate:
                </label>
                <textarea
                  rows={2}
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-sans focus:outline-none focus:border-indigo-500"
                  placeholder="Describe your desired plugin feature or workflow..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-300 font-semibold">
                    2. Copy Pre-Engineered Prompt (Contains GAW API + Active SQLite Schema):
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy AI Prompt'}</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-slate-300 max-h-72 overflow-auto whitespace-pre-wrap">
                    {generatedPrompt}
                  </pre>
                </div>
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-lg text-indigo-300 space-y-1">
                <span className="font-semibold block">How to use:</span>
                <p>
                  1. Click <strong>Copy AI Prompt</strong> above.<br />
                  2. Paste into <strong>Google Gemini, Claude, or ChatGPT</strong>.<br />
                  3. Paste the generated TSX code directly into GAW's <strong>internal IDE</strong> or click "New Plugin". It compiles instantly with 0 restart!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                One-click install pre-built, production-grade TSX plugins directly into your active SQLite database's <code className="text-indigo-400">t_plugins</code> table:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">.tsx Module</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        onInstallPlugin({
                          id: tpl.id,
                          name: tpl.name,
                          description: tpl.description,
                          code: tpl.code,
                          icon: tpl.icon,
                          menu_category: tpl.category,
                          route: `/${tpl.id.replace('template_', '')}`,
                        });
                        onClose();
                      }}
                      className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Install into SQLite</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
