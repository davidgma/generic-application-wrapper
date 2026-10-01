export const DEFAULT_CRM_PLUGIN_CODE = `import React, { useState, useEffect, useMemo } from 'react';

export default function CustomerCrmPlugin({ gaw }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    id: '',
    company_name: '',
    contact_name: '',
    contact_title: '',
    city: '',
    country: '',
    phone: '',
    credit_limit: 10000,
    status: 'ACTIVE'
  });

  const loadCustomers = () => {
    try {
      const data = gaw.db.queryObjects(
        'SELECT id, company_name, contact_name, contact_title, city, country, phone, credit_limit, status FROM customers ORDER BY company_name ASC'
      );
      setCustomers(data);
    } catch (err) {
      gaw.toast.error('Failed to load customers: ' + err.message);
    }
  };

  useEffect(() => {
    loadCustomers();
    const unsub = gaw.eventBus.on('db_changed', loadCustomers);
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return customers.filter(c => {
      const matchSearch =
        (c.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.country || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [customers, search, statusFilter]);

  const stats = useMemo(() => {
    const totalCredit = customers.reduce((sum, c) => sum + (Number(c.credit_limit) || 0), 0);
    const activeCount = customers.filter(c => c.status === 'ACTIVE').length;
    return { count: customers.length, totalCredit, activeCount };
  }, [customers]);

  const handleCreateCustomer = (e) => {
    e.preventDefault();
    if (!newCustomer.company_name.trim()) {
      gaw.toast.warning('Company name is required');
      return;
    }
    const id = newCustomer.id.trim() || 'CUST-' + Math.floor(1000 + Math.random() * 9000);
    try {
      gaw.db.run(
        'INSERT INTO customers (id, company_name, contact_name, contact_title, city, country, phone, credit_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          newCustomer.company_name,
          newCustomer.contact_name,
          newCustomer.contact_title,
          newCustomer.city,
          newCustomer.country,
          newCustomer.phone,
          Number(newCustomer.credit_limit) || 0,
          newCustomer.status
        ]
      );
      gaw.toast.success('Customer ' + newCustomer.company_name + ' created in SQLite!');
      setIsModalOpen(false);
      setNewCustomer({
        id: '',
        company_name: '',
        contact_name: '',
        contact_title: '',
        city: '',
        country: '',
        phone: '',
        credit_limit: 10000,
        status: 'ACTIVE'
      });
      loadCustomers();
      gaw.eventBus.emit('db_changed');
    } catch (err) {
      gaw.toast.error('Failed to create customer: ' + err.message);
    }
  };

  const handleDelete = async (cust) => {
    const ok = await gaw.dialog.confirm('Are you sure you want to delete customer "' + cust.company_name + '"?');
    if (!ok) return;
    try {
      gaw.db.run('DELETE FROM customers WHERE id = ?', [cust.id]);
      gaw.toast.info('Customer deleted.');
      if (selectedCustomer?.id === cust.id) setSelectedCustomer(null);
      loadCustomers();
      gaw.eventBus.emit('db_changed');
    } catch (err) {
      gaw.toast.error('Cannot delete customer: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Customer Directory & CRM</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Native SQLite Plugin
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manages client accounts, credit limits, and orders directly inside this .db file.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => gaw.navigation.openQuery('SELECT * FROM customers;')}
            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Open in SQL IDE
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
          >
            + New Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Accounts</span>
          <div className="text-2xl font-bold text-white mt-1">{stats.count}</div>
          <div className="text-[11px] text-emerald-400 mt-1">{stats.activeCount} active accounts</div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Credit Limit</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">\${stats.totalCredit.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Authorized credit line pool</div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Average Credit Line</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            \${stats.count ? Math.round(stats.totalCredit / stats.count).toLocaleString() : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Per active enterprise account</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by company, contact, city, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Status:</span>
          {['ALL', 'ACTIVE', 'VIP', 'HOLD'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={\`px-2.5 py-1 text-xs rounded font-medium transition \${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }\`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table & Detail Split */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        <div className="flex-1 bg-slate-950/60 rounded-lg border border-slate-800 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800/90 sticky top-0 text-slate-300 font-semibold border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Credit Limit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className={\`hover:bg-slate-800/50 cursor-pointer transition \${
                    selectedCustomer?.id === c.id ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : ''
                  }\`}
                >
                  <td className="py-2 px-3 font-medium text-white">{c.company_name}</td>
                  <td className="py-2 px-3">
                    <div>{c.contact_name}</div>
                    <div className="text-[10px] text-slate-500">{c.contact_title}</div>
                  </td>
                  <td className="py-2 px-3 text-slate-400">{c.city}, {c.country}</td>
                  <td className="py-2 px-3 font-mono text-emerald-400">\${Number(c.credit_limit || 0).toLocaleString()}</td>
                  <td className="py-2 px-3">
                    <span className={\`px-2 py-0.5 rounded text-[10px] font-semibold \${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : c.status === 'VIP'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-amber-500/20 text-amber-400'
                    }\`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c);
                      }}
                      className="px-2 py-1 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No customers match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Customer Panel */}
        {selectedCustomer && (
          <div className="w-80 flex-shrink-0 bg-slate-800/90 rounded-lg border border-slate-700/80 p-4 flex flex-col justify-between overflow-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Account Dossier</span>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3">
                <h3 className="text-base font-bold text-white">{selectedCustomer.company_name}</h3>
                <p className="text-xs text-slate-400">{selectedCustomer.contact_name} ({selectedCustomer.contact_title})</p>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Account ID:</span>
                  <span className="font-mono text-white">{selectedCustomer.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">City / Country:</span>
                  <span className="text-white">{selectedCustomer.city}, {selectedCustomer.country}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-white">{selectedCustomer.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Credit Limit:</span>
                  <span className="font-mono text-emerald-400 font-bold">\${Number(selectedCustomer.credit_limit || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Account Status:</span>
                  <span className="font-semibold text-indigo-300">{selectedCustomer.status}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-700 space-y-2">
              <button
                onClick={() => {
                  gaw.navigation.openQuery(
                    "SELECT o.id, o.order_date, o.ship_country, o.total_amount, o.status FROM orders o WHERE o.customer_id = '" +
                      selectedCustomer.id +
                      "' ORDER BY o.order_date DESC;"
                  );
                }}
                className="w-full py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition text-center"
              >
                View Customer Orders in IDE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl text-slate-100">
            <h2 className="text-lg font-bold text-white mb-4">Create New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newCustomer.contact_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contact_name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Contact Title</label>
                  <input
                    type="text"
                    value={newCustomer.contact_title}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contact_title: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">City</label>
                  <input
                    type="text"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Country</label>
                  <input
                    type="text"
                    value={newCustomer.country}
                    onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    value={newCustomer.credit_limit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Status</label>
                  <select
                    value={newCustomer.status}
                    onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="VIP">VIP</option>
                    <option value="HOLD">HOLD</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white"
                >
                  Save to SQLite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

export const DEFAULT_INVENTORY_PLUGIN_CODE = `import React, { useState, useEffect, useMemo } from 'react';

export default function InventoryValuatorPlugin({ gaw }) {
  const [products, setProducts] = useState([]);
  const [filterThreshold, setFilterThreshold] = useState(25);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const loadProducts = () => {
    try {
      const data = gaw.db.queryObjects(
        'SELECT p.id, p.name, p.sku, p.category_id, c.name as category, p.unit_price, p.units_in_stock, p.reorder_level ' +
        'FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.units_in_stock ASC'
      );
      setProducts(data);
    } catch (err) {
      gaw.toast.error('Failed to load inventory: ' + err.message);
    }
  };

  useEffect(() => {
    loadProducts();
    const unsub = gaw.eventBus.on('db_changed', loadProducts);
    return unsub;
  }, []);

  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ['ALL', ...list];
  }, [products]);

  const valuationStats = useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const qty = Number(p.units_in_stock) || 0;
      const price = Number(p.unit_price) || 0;
      totalItems += qty;
      totalValue += qty * price;
      if (qty <= (p.reorder_level || 15)) {
        lowStockCount++;
      }
    });

    return { totalItems, totalValue, lowStockCount, totalSkus: products.length };
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchesThreshold = p.units_in_stock <= filterThreshold;
      return matchesCat && matchesThreshold;
    });
  }, [products, selectedCategory, filterThreshold]);

  const handleRestock = (product, amount = 50) => {
    try {
      gaw.db.run(
        'UPDATE products SET units_in_stock = units_in_stock + ? WHERE id = ?',
        [amount, product.id]
      );
      gaw.toast.success('Restocked ' + product.name + ' (+ ' + amount + ' units)');
      loadProducts();
      gaw.eventBus.emit('db_changed');
    } catch (err) {
      gaw.toast.error('Failed to restock: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-hidden">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">Inventory Valuation & Reorder Desk</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor real-time warehouse inventory value, low-stock triggers, and execute immediate batch restocks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const res = gaw.db.query(
                'SELECT p.name, c.name as category, p.unit_price, p.units_in_stock, (p.unit_price * p.units_in_stock) as inventory_value ' +
                'FROM products p JOIN categories c ON p.category_id = c.id;'
              );
              gaw.navigation.openSpreadsheet(res, 'Inventory Valuation');
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
          >
            Export to Spreadsheet
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 my-5">
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase">Gross Inventory Value</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            \${Math.round(valuationStats.totalValue).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Current assets on hand</div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase">Units In Stock</span>
          <div className="text-2xl font-bold text-white mt-1">
            {valuationStats.totalItems.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across {valuationStats.totalSkus} SKUs</div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase">Low Stock Alerts</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {valuationStats.lowStockCount}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">Below reorder safety mark</div>
        </div>
        <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <span className="text-[11px] font-medium text-slate-400 uppercase">Avg Unit Cost</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            \${valuationStats.totalItems ? (valuationStats.totalValue / valuationStats.totalItems).toFixed(2) : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Weighted asset average</div>
        </div>
      </div>

      {/* Filter and threshold slider */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950/80 rounded-lg border border-slate-800 mb-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-medium">Max Stock Threshold: <strong className="text-indigo-400">{filterThreshold}</strong> units</span>
          <input
            type="range"
            min="5"
            max="150"
            value={filterThreshold}
            onChange={(e) => setFilterThreshold(Number(e.target.value))}
            className="accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 bg-slate-950/60 rounded-lg border border-slate-800 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-800/90 sticky top-0 text-slate-300 font-semibold border-b border-slate-700">
            <tr>
              <th className="py-2.5 px-3">Product Name</th>
              <th className="py-2.5 px-3">SKU</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Unit Price</th>
              <th className="py-2.5 px-3">Stock Level</th>
              <th className="py-2.5 px-3">Valuation</th>
              <th className="py-2.5 px-3 text-right">Quick Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.map((p) => {
              const isCritical = p.units_in_stock <= (p.reorder_level || 15);
              return (
                <tr key={p.id} className="hover:bg-slate-800/50 transition">
                  <td className="py-2.5 px-3 font-medium text-white">{p.name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{p.sku}</td>
                  <td className="py-2.5 px-3 text-indigo-300">{p.category}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-200">\${Number(p.unit_price).toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <span className={\`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold \${
                      isCritical ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-300'
                    }\`}>
                      {p.units_in_stock}
                      {isCritical && <span className="text-[10px]">⚠️ Low</span>}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-emerald-400">
                    \${(p.units_in_stock * p.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleRestock(p, 50)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-600/80 hover:bg-indigo-600 text-white transition shadow-sm"
                    >
                      +50 Units
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;

export const DEFAULT_EXECUTIVE_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';

export default function ExecutivePulsePlugin({ gaw }) {
  const [metrics, setMetrics] = useState({
    customers: 0,
    orders: 0,
    revenue: 0,
    avgOrder: 0,
    recentOrders: []
  });

  const loadData = () => {
    try {
      const summary = gaw.db.queryObjects(
        'SELECT (SELECT COUNT(*) FROM customers) as customers, ' +
        '(SELECT COUNT(*) FROM orders) as orders, ' +
        '(SELECT ROUND(SUM(total_amount), 2) FROM orders) as revenue, ' +
        '(SELECT ROUND(AVG(total_amount), 2) FROM orders) as avgOrder'
      )[0] || {};

      const recentOrders = gaw.db.queryObjects(
        'SELECT o.id, c.company_name, o.ship_country, o.total_amount, o.status, o.order_date ' +
        'FROM orders o JOIN customers c ON o.customer_id = c.id ORDER BY o.order_date DESC LIMIT 8'
      );

      setMetrics({
        customers: summary.customers || 0,
        orders: summary.orders || 0,
        revenue: summary.revenue || 0,
        avgOrder: summary.avgOrder || 0,
        recentOrders
      });
    } catch (err) {
      gaw.toast.error('Failed to load executive metrics: ' + err.message);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = gaw.eventBus.on('db_changed', loadData);
    return unsub;
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-auto">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">Executive Pulse & Financial Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggregated business KPIs computed directly from SQLite relational tables.
          </p>
        </div>
        <button
          onClick={() => gaw.navigation.openReport('report_exec_overview')}
          className="px-3.5 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          View Executive Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 my-6">
        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-900/40 to-slate-800 border border-indigo-500/20 shadow-md">
          <span className="text-[11px] font-semibold text-indigo-300 uppercase">Gross Revenue</span>
          <div className="text-3xl font-extrabold text-white mt-1">\${metrics.revenue.toLocaleString()}</div>
          <span className="text-[11px] text-emerald-400 mt-1 block">▲ +14.2% vs previous period</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Orders</span>
          <div className="text-3xl font-extrabold text-white mt-1">{metrics.orders}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Completed & in transit</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Average Ticket</span>
          <div className="text-3xl font-extrabold text-indigo-400 mt-1">\${metrics.avgOrder}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Per closed order</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Customer Accounts</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{metrics.customers}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active global partners</span>
        </div>
      </div>

      <div className="mt-2 bg-slate-950/70 border border-slate-800 rounded-xl p-5 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">Recent Real-time Orders</h2>
          <span className="text-xs text-slate-400 font-mono">SQLite View</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Order ID</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Ship Country</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {metrics.recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-mono text-indigo-300">{o.id}</td>
                  <td className="py-2.5 px-3 font-medium text-white">{o.company_name}</td>
                  <td className="py-2.5 px-3 text-slate-400">{o.order_date}</td>
                  <td className="py-2.5 px-3">{o.ship_country}</td>
                  <td className="py-2.5 px-3 font-mono text-emerald-400">\${Number(o.total_amount).toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
