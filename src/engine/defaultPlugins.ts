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

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

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
    <div className={'flex flex-col min-h-full p-6 pb-20 ' + (isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800')}>
      {/* Top Header */}
      <div className={'flex flex-wrap items-center justify-between gap-4 pb-5 border-b ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className={'text-xl font-bold tracking-tight ' + (isDark ? 'text-white' : 'text-slate-900')}>Customer Directory & CRM</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Native SQLite Plugin
            </span>
          </div>
          <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
            Manages client accounts, credit limits, and orders directly inside this .db file.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => gaw.navigation.openQuery('SELECT * FROM customers;')}
            className={'px-3 py-1.5 text-xs font-medium rounded border transition ' + (
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
            )}
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
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Total Accounts</span>
          <div className={'text-2xl font-bold mt-1 ' + (isDark ? 'text-white' : 'text-slate-900')}>{stats.count}</div>
          <div className="text-[11px] text-emerald-500 mt-1">{stats.activeCount} active accounts</div>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Total Credit Limit</span>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{'$' + stats.totalCredit.toLocaleString()}</div>
          <div className={'text-[11px] mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Authorized credit line pool</div>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Average Credit Line</span>
          <div className="text-2xl font-bold text-indigo-500 mt-1">
            {'$' + (stats.count ? Math.round(stats.totalCredit / stats.count).toLocaleString() : 0)}
          </div>
          <div className={'text-[11px] mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Per active enterprise account</div>
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
            className={'w-full px-3 py-1.5 text-xs rounded border focus:outline-none focus:border-indigo-500 ' + (
              isDark ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Status:</span>
          {['ALL', 'ACTIVE', 'VIP', 'HOLD'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={'px-2.5 py-1 text-xs rounded font-medium transition ' + (
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow'
                  : isDark
                  ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  : 'bg-slate-200 text-slate-600 hover:text-slate-900'
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table & Detail Split */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        <div className={'flex-1 rounded-xl border overflow-auto shadow-sm ' + (isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200')}>
          <table className="w-full text-left text-xs border-collapse">
            <thead className={'sticky top-0 font-semibold border-b ' + (isDark ? 'bg-slate-800/90 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200')}>
              <tr>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Credit Limit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={'divide-y ' + (isDark ? 'divide-slate-800/60 text-slate-300' : 'divide-slate-200 text-slate-700')}>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className={'cursor-pointer transition ' + (
                    isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                  ) + ' ' + (
                    selectedCustomer?.id === c.id
                      ? (isDark ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : 'bg-indigo-50/70 border-l-2 border-indigo-500')
                      : ''
                  )}
                >
                  <td className={'py-2 px-3 font-medium ' + (isDark ? 'text-white' : 'text-slate-900')}>{c.company_name}</td>
                  <td className="py-2 px-3">
                    <div>{c.contact_name}</div>
                    <div className={'text-[10px] ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>{c.contact_title}</div>
                  </td>
                  <td className={'py-2 px-3 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{c.city}, {c.country}</td>
                  <td className="py-2 px-3 font-mono text-emerald-500 font-semibold">{'$' + Number(c.credit_limit || 0).toLocaleString()}</td>
                  <td className="py-2 px-3">
                    <span className={'px-2 py-0.5 rounded text-[10px] font-semibold ' + (
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-500'
                        : c.status === 'VIP'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-amber-500/20 text-amber-500'
                    )}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c);
                      }}
                      className="px-2 py-1 text-[11px] text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No customers match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Customer Panel */}
        {selectedCustomer && (
          <div className={'w-80 flex-shrink-0 rounded-xl border p-4 flex flex-col justify-between overflow-auto shadow-sm ' + (
            isDark ? 'bg-slate-800/90 border-slate-700/80' : 'bg-white border-slate-200'
          )}>
            <div>
              <div className={'flex items-center justify-between border-b pb-3 ' + (isDark ? 'border-slate-700' : 'border-slate-200')}>
                <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Account Dossier</span>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className={'text-xs p-1 ' + (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900')}
                >
                  ✕
                </button>
              </div>
              <div className="mt-3">
                <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>{selectedCustomer.company_name}</h3>
                <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{selectedCustomer.contact_name} ({selectedCustomer.contact_title})</p>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className={'flex justify-between py-1 border-b ' + (isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Account ID:</span>
                  <span className={'font-mono font-medium ' + (isDark ? 'text-white' : 'text-slate-900')}>{selectedCustomer.id}</span>
                </div>
                <div className={'flex justify-between py-1 border-b ' + (isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>City / Country:</span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>{selectedCustomer.city}, {selectedCustomer.country}</span>
                </div>
                <div className={'flex justify-between py-1 border-b ' + (isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Phone:</span>
                  <span className={isDark ? 'text-white' : 'text-slate-900'}>{selectedCustomer.phone || 'N/A'}</span>
                </div>
                <div className={'flex justify-between py-1 border-b ' + (isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Credit Limit:</span>
                  <span className="font-mono text-emerald-500 font-bold">{'$' + Number(selectedCustomer.credit_limit || 0).toLocaleString()}</span>
                </div>
                <div className={'flex justify-between py-1 border-b ' + (isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Account Status:</span>
                  <span className="font-semibold text-indigo-500">{selectedCustomer.status}</span>
                </div>
              </div>
            </div>

            <div className={'mt-6 pt-3 border-t space-y-2 ' + (isDark ? 'border-slate-700' : 'border-slate-200')}>
              <button
                onClick={() => {
                  gaw.navigation.openQuery(
                    "SELECT o.id, o.order_date, o.ship_country, o.total_amount, o.status FROM orders o WHERE o.customer_id = '" +
                      selectedCustomer.id +
                      "' ORDER BY o.order_date DESC;"
                  );
                }}
                className="w-full py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition text-center shadow"
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
          <div className={'w-full max-w-md rounded-xl p-6 shadow-2xl border ' + (
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          )}>
            <h2 className={'text-lg font-bold mb-4 ' + (isDark ? 'text-white' : 'text-slate-900')}>Create New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Company Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                  className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                    isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Contact Name</label>
                  <input
                    type="text"
                    value={newCustomer.contact_name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contact_name: e.target.value })}
                    className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Contact Title</label>
                  <input
                    type="text"
                    value={newCustomer.contact_title}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contact_title: e.target.value })}
                    className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>City</label>
                  <input
                    type="text"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Country</label>
                  <input
                    type="text"
                    value={newCustomer.country}
                    onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })}
                    className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Credit Limit ($)</label>
                  <input
                    type="number"
                    value={newCustomer.credit_limit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: Number(e.target.value) })}
                    className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={'block mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>Status</label>
                  <select
                    value={newCustomer.status}
                    onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value })}
                    className={'w-full px-3 py-1.5 rounded border focus:outline-none focus:border-indigo-500 ' + (
                      isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                    )}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="VIP">VIP</option>
                    <option value="HOLD">HOLD</option>
                  </select>
                </div>
              </div>
              <div className={'flex justify-end gap-2 pt-4 border-t ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={'px-3 py-1.5 rounded transition ' + (
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow"
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

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

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
    <div className={'flex flex-col min-h-full p-6 pb-20 ' + (isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800')}>
      <div className={'flex flex-wrap items-center justify-between gap-4 pb-4 border-b ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
        <div>
          <h1 className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Inventory Valuation & Reorder Desk</h1>
          <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
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
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Gross Inventory Value</span>
          <div className="text-2xl font-bold text-emerald-500 mt-1">
            {'$' + Math.round(valuationStats.totalValue).toLocaleString()}
          </div>
          <div className={'text-[11px] mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Current assets on hand</div>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Units In Stock</span>
          <div className={'text-2xl font-bold mt-1 ' + (isDark ? 'text-white' : 'text-slate-900')}>
            {valuationStats.totalItems.toLocaleString()}
          </div>
          <div className={'text-[11px] mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Across {valuationStats.totalSkus} SKUs</div>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Low Stock Alerts</span>
          <div className="text-2xl font-bold text-amber-500 mt-1">
            {valuationStats.lowStockCount}
          </div>
          <div className="text-[11px] text-amber-500 mt-1">Below reorder safety mark</div>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-medium uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Avg Unit Cost</span>
          <div className="text-2xl font-bold text-indigo-500 mt-1">
            {'$' + (valuationStats.totalItems ? (valuationStats.totalValue / valuationStats.totalItems).toFixed(2) : '0.00')}
          </div>
          <div className={'text-[11px] mt-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Weighted asset average</div>
        </div>
      </div>

      {/* Filter and threshold slider */}
      <div className={'flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl border mb-4 text-xs shadow-sm ' + (
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
      )}>
        <div className="flex items-center gap-3">
          <span className={isDark ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={'px-2.5 py-1 rounded border focus:outline-none ' + (
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
            )}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className={isDark ? 'text-slate-400 font-medium' : 'text-slate-600 font-medium'}>
            Max Stock Threshold: <strong className="text-indigo-500">{filterThreshold}</strong> units
          </span>
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
      <div className={'flex-1 rounded-xl border overflow-auto shadow-sm ' + (
        isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
      )}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={'sticky top-0 font-semibold border-b ' + (
            isDark ? 'bg-slate-800/90 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
          )}>
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
          <tbody className={'divide-y ' + (isDark ? 'divide-slate-800/60 text-slate-300' : 'divide-slate-200 text-slate-700')}>
            {filtered.map((p) => {
              const isCritical = p.units_in_stock <= (p.reorder_level || 15);
              return (
                <tr key={p.id} className={'transition ' + (isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                  <td className={'py-2.5 px-3 font-medium ' + (isDark ? 'text-white' : 'text-slate-900')}>{p.name}</td>
                  <td className={'py-2.5 px-3 font-mono ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{p.sku}</td>
                  <td className="py-2.5 px-3 text-indigo-500 font-medium">{p.category}</td>
                  <td className={'py-2.5 px-3 font-mono ' + (isDark ? 'text-slate-200' : 'text-slate-700')}>{'$' + Number(p.unit_price).toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <span className={'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ' + (
                      isCritical ? 'bg-red-500/20 text-red-500 border border-red-500/30' : (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700')
                    )}>
                      {p.units_in_stock}
                      {isCritical && <span className="text-[10px]">⚠️ Low</span>}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-emerald-500 font-semibold">
                    {'$' + (p.units_in_stock * p.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleRestock(p, 50)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
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

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

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
    <div className={'flex flex-col min-h-full p-6 pb-20 ' + (isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800')}>
      <div className={'flex flex-wrap items-center justify-between gap-4 pb-4 border-b ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
        <div>
          <h1 className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Executive Pulse & Financial Overview</h1>
          <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
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
        <div className={'p-4 rounded-xl border shadow-sm ' + (
          isDark
            ? 'bg-gradient-to-br from-indigo-900/40 to-slate-800 border-indigo-500/20'
            : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200'
        )}>
          <span className="text-[11px] font-semibold text-indigo-500 uppercase">Gross Revenue</span>
          <div className={'text-3xl font-extrabold mt-1 ' + (isDark ? 'text-white' : 'text-slate-900')}>{'$' + metrics.revenue.toLocaleString()}</div>
          <span className="text-[11px] text-emerald-500 mt-1 block">▲ +14.2% vs previous period</span>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-semibold uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Total Orders</span>
          <div className={'text-3xl font-extrabold mt-1 ' + (isDark ? 'text-white' : 'text-slate-900')}>{metrics.orders}</div>
          <span className={'text-[11px] mt-1 block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Completed & in transit</span>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-semibold uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Average Ticket</span>
          <div className="text-3xl font-extrabold text-indigo-500 mt-1">{'$' + metrics.avgOrder}</div>
          <span className={'text-[11px] mt-1 block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Per closed order</span>
        </div>
        <div className={'p-4 rounded-xl border shadow-sm ' + (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}>
          <span className={'text-[11px] font-semibold uppercase ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Customer Accounts</span>
          <div className="text-3xl font-extrabold text-emerald-500 mt-1">{metrics.customers}</div>
          <span className={'text-[11px] mt-1 block ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Active global partners</span>
        </div>
      </div>

      <div className={'mt-2 rounded-xl p-5 border shadow-sm ' + (isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-white border-slate-200')}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Recent Real-time Orders</h2>
          <span className={'text-xs font-mono ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>SQLite View</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={'border-b ' + (isDark ? 'text-slate-400 border-slate-800' : 'text-slate-600 border-slate-200')}>
              <tr>
                <th className="py-2 px-3">Order ID</th>
                <th className="py-2 px-3">Customer</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Ship Country</th>
                <th className="py-2 px-3">Amount</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className={'divide-y ' + (isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700')}>
              {metrics.recentOrders.map((o) => (
                <tr key={o.id} className={'transition ' + (isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')}>
                  <td className="py-2.5 px-3 font-mono text-indigo-500 font-semibold">{o.id}</td>
                  <td className={'py-2.5 px-3 font-medium ' + (isDark ? 'text-white' : 'text-slate-900')}>{o.company_name}</td>
                  <td className={'py-2.5 px-3 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{o.order_date}</td>
                  <td className="py-2.5 px-3">{o.ship_country}</td>
                  <td className="py-2.5 px-3 font-mono text-emerald-500 font-semibold">{'$' + Number(o.total_amount).toFixed(2)}</td>
                  <td className="py-2.5 px-3">
                    <span className={'px-2 py-0.5 rounded text-[10px] font-bold border ' + (
                      isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
                    )}>
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

export const DEFAULT_HELLO_WORLD_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';

/**
 * Gawkyy (Generic Application Wrapper) - Hello World Plugin
 * --------------------------------------------------------
 * This simple example demonstrates how to write a dynamic plugin in GAW.
 *
 * Plugins are standard React components with access to the 'gaw' object:
 *  - gaw.db.query(sql, params) -> returns { columns, values }
 *  - gaw.db.queryObjects(sql, params) -> returns an array of JavaScript objects
 *  - gaw.db.run(sql, params) -> executes INSERT, UPDATE, DELETE, CREATE
 *  - gaw.toast.success / error / info / warning -> in-app notifications
 *  - gaw.dialog.confirm / alert / prompt -> interactive dialogs
 *  - gaw.eventBus.on('db_changed', callback) -> listen for database mutations
 *  - gaw.theme -> current visual theme ('vs-dark' or 'vs-light')
 */

export default function HelloWorldPlugin({ gaw }) {
  const [userName, setUserName] = useState('World');
  const [clickCount, setClickCount] = useState(0);
  const [dbGreeting, setDbGreeting] = useState('');
  const [tableCount, setTableCount] = useState(0);

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

  // 1. Run a query on the in-browser SQLite database
  const fetchDbGreeting = () => {
    try {
      // Query SQLite directly in WebAssembly
      const result = gaw.db.queryObjects("SELECT 'Hello from SQLite in WebAssembly!' AS message;");
      if (result.length > 0) {
        setDbGreeting(result[0].message);
      }

      // Count user tables
      const tables = gaw.db.queryObjects("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      setTableCount(tables[0]?.count || 0);

      gaw.toast.info('Queried SQLite database successfully!');
    } catch (err) {
      gaw.toast.error('Query error: ' + err.message);
    }
  };

  useEffect(() => {
    fetchDbGreeting();
  }, []);

  const handleSayHello = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    gaw.toast.success('Hello, ' + (userName || 'Friend') + '! (Click #' + nextCount + ')');
  };

  const handleDialogDemo = async () => {
    const ok = await gaw.dialog.confirm('Hello ' + (userName || 'Friend') + '! Do you want to test an interactive dialog?');
    if (ok) {
      gaw.toast.success('You clicked OK in the dialog!');
    } else {
      gaw.toast.info('You cancelled the dialog.');
    }
  };

  return (
    <div className={'p-8 max-w-4xl mx-auto space-y-6 pb-24 ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
      {/* Header Banner */}
      <div className={'border rounded-2xl p-6 shadow-xl backdrop-blur ' + (
        isDark
          ? 'bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border-indigo-700/50'
          : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'
      )}>
        <span className={'text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ' + (
          isDark ? 'text-indigo-300 bg-indigo-950/80 border-indigo-700/50' : 'text-indigo-700 bg-indigo-100 border-indigo-300'
        )}>
          Starter Plugin Guide
        </span>
        <h1 className={'text-2xl font-bold mt-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
          👋 Hello, {userName || 'World'}!
        </h1>
        <p className={'text-xs mt-1 max-w-2xl leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-600')}>
          Welcome to your first GAW plugin! This component is compiled on-the-fly inside your browser
          using Sucrase and runs locally with direct access to your SQLite database.
        </p>
      </div>

      {/* Interactive Controls Card */}
      <div className={'border rounded-xl p-6 space-y-4 shadow-sm ' + (
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      )}>
        <h2 className={'text-sm font-bold flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
          <span>⚡ Interactive Plugin State Demo</span>
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex-1 w-full">
            <label className={'block text-[11px] mb-1 font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
              Enter your name:
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Alice"
              className={'w-full px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-indigo-500 border ' + (
                isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
              )}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto pt-4 sm:pt-0">
            <button
              onClick={handleSayHello}
              className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow transition active:scale-95"
            >
              Say Hello! ({clickCount})
            </button>
            <button
              onClick={handleDialogDemo}
              className={'flex-1 sm:flex-none px-3 py-2 text-xs rounded-lg border transition ' + (
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              )}
            >
              Test Dialog
            </button>
          </div>
        </div>
      </div>

      {/* SQLite Live Database Connection Card */}
      <div className={'border rounded-xl p-6 space-y-3 shadow-sm ' + (
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      )}>
        <h2 className={'text-sm font-bold flex items-center justify-between ' + (isDark ? 'text-white' : 'text-slate-900')}>
          <span>🗄️ Live SQLite Integration</span>
          <button
            onClick={fetchDbGreeting}
            className="text-[11px] text-indigo-500 hover:text-indigo-400 font-normal transition"
          >
            Re-run Query
          </button>
        </h2>
        <div className={'p-3 rounded-lg space-y-1 font-mono text-xs border ' + (
          isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
        )}>
          <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Query Output:</p>
          <p className="text-emerald-500 font-semibold">{dbGreeting || 'Querying database...'}</p>
          <p className={'text-[10px] pt-1 ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>
            Database contains {tableCount} active tables.
          </p>
        </div>
      </div>

      {/* Quick Reference Code Explanation */}
      <div className={'border rounded-xl p-5 space-y-2 text-xs ' + (
        isDark ? 'bg-slate-950/60 border-slate-800/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
      )}>
        <h3 className={'font-semibold ' + (isDark ? 'text-slate-200' : 'text-slate-800')}>How to edit this plugin:</h3>
        <p>
          Click the three dots <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>(···)</strong> next to "Hello World Starter" in the left sidebar and choose <strong className="text-indigo-500">Edit in IDE</strong>. Any changes you make will instantly hot-reload here!
        </p>
      </div>
    </div>
  );
}
`;

export const DEFAULT_DATABASE_MANAGEMENT_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';
import {
  Database,
  Terminal,
  Download,
  RotateCcw,
  Table as TableIcon,
  Sparkles,
  RefreshCw,
  HardDrive,
  Layers,
  Code2
} from 'lucide-react';

export default function DatabaseManagementPlugin({ gaw }) {
  const isDark = gaw.theme === 'vs-dark';
  const [tables, setTables] = useState(() => {
    try {
      return gaw.db.getSchema() || [];
    } catch {
      return [];
    }
  });

  const [stats, setStats] = useState(() => {
    try {
      const pageCount = gaw.db.query('PRAGMA page_count;').values[0]?.[0] || 0;
      const pageSize = gaw.db.query('PRAGMA page_size;').values[0]?.[0] || 4096;
      const schemaVer = gaw.db.query('PRAGMA schema_version;').values[0]?.[0] || 1;
      return { pageCount, pageSize, schemaVer, totalBytes: pageCount * pageSize };
    } catch {
      return { pageCount: 0, pageSize: 4096, schemaVer: 1, totalBytes: 0 };
    }
  });

  const refreshState = () => {
    try {
      setTables(gaw.db.getSchema() || []);
      const pageCount = gaw.db.query('PRAGMA page_count;').values[0]?.[0] || 0;
      const pageSize = gaw.db.query('PRAGMA page_size;').values[0]?.[0] || 4096;
      const schemaVer = gaw.db.query('PRAGMA schema_version;').values[0]?.[0] || 1;
      setStats({ pageCount, pageSize, schemaVer, totalBytes: pageCount * pageSize });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const unsub = gaw.eventBus?.on('db:change', () => refreshState());
    return () => {
      if (unsub) unsub();
    };
  }, [gaw.eventBus]);

  const handleResetDefault = async () => {
    const confirmed = await gaw.dialog.confirm(
      'Reset database to Northwind Modern Commerce template? All current data will be replaced.'
    );
    if (!confirmed) return;
    gaw.workspace.loadNorthwindDemo();
    refreshState();
    gaw.toast.success('Loaded Northwind Modern Commerce template.');
  };

  const handleExportBinary = () => {
    gaw.storage.exportDownload();
    gaw.toast.success('Exported SQLite binary file.');
  };

  return (
    <div className={'flex-1 overflow-y-auto p-4 md:p-6 select-text transition-colors ' + (
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    )}>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + (
              isDark ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'
            )}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className={'text-base font-bold ' + (isDark ? 'text-sky-300' : 'text-blue-700')}>
                Database Engine & SQL Management
              </h2>
              <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                Embedded SQLite (sql.js WebAssembly) with in-memory execution and zero-latency local queries.
              </p>
            </div>
          </div>

          <button
            onClick={refreshState}
            className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition active:scale-95 ' + (
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            )}
            title="Refresh database schema and telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh State</span>
          </button>
        </div>

        {/* Database Primary Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {/* 1. Open SQL Query Editor */}
          <div className={'p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ' + (
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
          )}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">SQL Query Editor</h3>
              <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                Execute custom SQL statements, JOINs, aggregations, and DDL queries in Monaco editor.
              </p>
            </div>
            <button
              onClick={() => gaw.navigation.openIDE({ type: 'sql' })}
              className="mt-3 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Open Query Editor</span>
            </button>
          </div>

          {/* 2. Export Database Binary */}
          <div className={'p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ' + (
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'
          )}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Export SQLite Binary</h3>
              <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                Download the raw .db binary file directly to your disk. Opens in DB Browser or standard SQLite tools.
              </p>
            </div>
            <button
              onClick={handleExportBinary}
              className="mt-3 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .db</span>
            </button>
          </div>

          {/* 3. Reset to Northwind Template */}
          <div className={'p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ' + (
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-red-500/50' : 'bg-white border-slate-200 hover:border-red-300'
          )}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Reset Database</h3>
              <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                Revert back to the pristine Northwind Modern Commerce sample suite with all initial tables.
              </p>
            </div>
            <button
              onClick={handleResetDefault}
              className={'mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition active:scale-95 flex items-center justify-center gap-1.5 ' + (
                isDark ? 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/40' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Database</span>
            </button>
          </div>
        </div>

        {/* Database Telemetry Stats */}
        <div className={'p-4 md:p-5 rounded-2xl border shadow-sm ' + (
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <h3 className={'text-xs font-bold uppercase tracking-wider mb-3 ' + (isDark ? 'text-sky-300/90' : 'text-blue-700')}>
            Database Engine Telemetry
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
              <span className={'block text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Page Count</span>
              <span className="font-mono font-bold text-sm">{stats.pageCount} pages</span>
            </div>
            <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
              <span className={'block text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Page Size</span>
              <span className="font-mono font-bold text-sm">{stats.pageSize} bytes</span>
            </div>
            <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
              <span className={'block text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Total Storage Size</span>
              <span className="font-mono font-bold text-sm">{(stats.totalBytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
              <span className={'block text-[10px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Schema Version</span>
              <span className="font-mono font-bold text-sm">v{stats.schemaVer}</span>
            </div>
          </div>
        </div>

        {/* Database Tables Explorer */}
        <div className={'p-4 md:p-5 rounded-2xl border shadow-sm ' + (
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
            <h3 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-sky-300/90' : 'text-blue-700')}>
              Database Tables ({tables.length})
            </h3>
            <button
              onClick={() => gaw.navigation.openIDE({ type: 'sql' })}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              + Create Table in SQL
            </button>
          </div>

          <div className="divide-y divide-slate-800/40 pt-1">
            {tables.map((t) => (
              <div
                key={t.name}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <TableIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {t.name}
                    </span>
                    <span className={'ml-2 text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                      ({t.columns.length} columns)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => gaw.navigation.navigate('/table/' + t.name)}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shadow transition active:scale-95"
                  >
                    View Grid
                  </button>
                  <button
                    onClick={() => gaw.navigation.openIDE({ type: 'table', name: t.name })}
                    className={'px-2.5 py-1 rounded border text-[11px] font-medium transition active:scale-95 ' + (
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    )}
                  >
                    Edit Schema
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SQLite Engine Diagnostics */}
        <div className={'p-4 md:p-5 rounded-2xl border shadow-sm space-y-3 ' + (
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
            <h3 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-sky-300/90' : 'text-blue-700')}>
              SQLite Engine Diagnostics
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">PRAGMA Inspector</span>
          </div>
          <div className={'grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 rounded-xl border font-mono ' + (
            isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
          )}>
            <div>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Database Name: </span>
              <span className={'font-bold ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
                {gaw.storage?.getMetadata?.()?.activeFileName || 'sqlite.db'}
              </span>
            </div>
            <div>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Schema Version: </span>
              <span className={'font-bold ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
                {stats.schemaVer}
              </span>
            </div>
            <div>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Page Count: </span>
              <span className={'font-bold ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
                {stats.pageCount}
              </span>
            </div>
            <div>
              <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Page Size: </span>
              <span className={'font-bold ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
                {stats.pageSize} bytes
              </span>
            </div>
            <div className="sm:col-span-2 pt-1 border-t border-slate-800/40 flex items-center justify-between">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Total File Footprint:</span>
              <span className="text-emerald-500 font-bold text-sm">{(stats.totalBytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

export const DEFAULT_DROPBOX_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Save,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Key,
  Lock,
  Folder,
  Database,
  ExternalLink,
  Clock,
  Settings,
  HardDrive,
  Eye,
  EyeOff
} from 'lucide-react';

export default function DropboxSyncPlugin({ gaw }) {
  const [config, setConfig] = useState(gaw.dropbox.getConfig());
  const [storageMeta, setStorageMeta] = useState(gaw.storage.getMetadata());
  const [tokenInput, setTokenInput] = useState(config.accessToken || '');
  const [showToken, setShowToken] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(config.clientId || '');
  const [autoInterval, setAutoInterval] = useState(config.autoSyncIntervalSec || 60);
  const [autoEnabled, setAutoEnabled] = useState(config.isAutoSyncEnabled !== false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [remoteFiles, setRemoteFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [activeTab, setActiveTab] = useState('sync');

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

  // Keep state in sync with external changes
  useEffect(() => {
    const unsubDropbox = gaw.dropbox.subscribe((cfg) => {
      setConfig(cfg);
      if (cfg.accessToken) setTokenInput(cfg.accessToken);
      if (cfg.clientId) setClientIdInput(cfg.clientId);
      if (cfg.autoSyncIntervalSec !== undefined) setAutoInterval(cfg.autoSyncIntervalSec);
      if (cfg.isAutoSyncEnabled !== undefined) setAutoEnabled(cfg.isAutoSyncEnabled);
    });

    const unsubStorage = gaw.storage.onStatusChange((meta) => {
      setStorageMeta(meta);
    });

    return () => {
      unsubDropbox();
      unsubStorage();
    };
  }, []);

  useEffect(() => {
    if (config.accessToken && !config.connected) {
      gaw.dropbox.validateToken();
    }
  }, []);

  const loadRemoteFiles = async () => {
    if (!config.connected) return;
    setLoadingFiles(true);
    try {
      const files = await gaw.dropbox.listDatabaseFiles('');
      setRemoteFiles(files);
    } catch (err) {
      gaw.toast.error('Failed to list files: ' + (err.message || String(err)));
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'browser' && config.connected) {
      loadRemoteFiles();
    }
  }, [activeTab, config.connected]);

  const [isSaving, setIsSaving] = useState(false);
  const [selectedIntervalOption, setSelectedIntervalOption] = useState(() => {
    const std = [5, 10, 30, 60, 300];
    const sec = config.autoSyncIntervalSec || 60;
    return std.includes(sec) ? String(sec) : 'custom';
  });
  const [customIntervalSeconds, setCustomIntervalSeconds] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gaw_dropbox_auto_sync_custom');
      if (saved) return saved;
    }
    return String(config.autoSyncIntervalSec || 45);
  });

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      gaw.toast.warning('Please enter a valid Dropbox access token.');
      return;
    }
    const ok = await gaw.dropbox.setAccessToken(tokenInput.trim());
    if (ok) {
      gaw.toast.success('Connected to Dropbox successfully!');
    } else {
      gaw.toast.error('Token validation failed. Please verify your token.');
    }
  };

  const handleSave = async () => {
    if (!config.connected) {
      gaw.toast.warning('Please connect your Dropbox account in the "Connection & API Keys" tab first.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await gaw.dropbox.save();
      gaw.toast.success('Saved active database to Dropbox (' + (res?.name || storageMeta.fileName) + ')');
    } catch (err: any) {
      gaw.toast.error('Save failed: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushNow = handleSave;

  const handleSaveAs = async () => {
    if (!config.connected) {
      gaw.toast.warning('Please connect your Dropbox account in the "Connection & API Keys" tab first.');
      return;
    }
    const defaultName = storageMeta.fileName || 'new_database.sqlite';
    const chosen = await gaw.dialog.prompt('Save a copy to Dropbox under new file name:', defaultName);
    if (!chosen) return;
    const finalName = chosen.trim().endsWith('.sqlite') || chosen.trim().endsWith('.db') || chosen.trim().endsWith('.sqlite3')
      ? chosen.trim()
      : chosen.trim() + '.sqlite';

    setIsSaving(true);
    try {
      const res = await gaw.dropbox.saveAs(finalName);
      gaw.toast.success('Saved new copy to Dropbox as ' + (res?.name || finalName) + '!');
    } catch (err: any) {
      gaw.toast.error('Save As failed: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePullNow = async () => {
    const remote = gaw.dropbox.getCurrentRemoteFile();
    if (!remote) {
      gaw.toast.warning('No active remote file selected. Please select a database from the browser tab.');
      return;
    }
    const confirmed = await gaw.dialog.confirm(
      'Are you sure you want to pull from Dropbox? Any unsaved local edits will be replaced with the remote version.'
    );
    if (!confirmed) return;

    setIsPulling(true);
    try {
      await gaw.dropbox.downloadFile(remote);
      gaw.workspace?.setSidebarOpen?.(true);
      gaw.toast.success('Successfully pulled ' + remote.name + ' from Dropbox!');
    } catch (err: any) {
      gaw.toast.error('Pull failed: ' + (err.message || String(err)));
    } finally {
      setIsPulling(false);
    }
  };

  const handleLoadRemoteFile = async (file: any) => {
    const confirmed = await gaw.dialog.confirm(
      'Load ' + file.name + ' into Gawkyy? This will switch your active database.'
    );
    if (!confirmed) return;

    try {
      await gaw.dropbox.downloadFile(file);
      gaw.workspace?.setSidebarOpen?.(true);
      gaw.toast.success('Loaded ' + file.name + ' from Dropbox!');
    } catch (err: any) {
      gaw.toast.error('Failed to load file: ' + (err.message || String(err)));
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await gaw.dialog.confirm('Disconnect Dropbox account and stop cloud sync?');
    if (confirmed) {
      gaw.dropbox.disconnect();
      gaw.toast.info('Disconnected from Dropbox.');
    }
  };

  const handleFrequencySelect = (val: string) => {
    setSelectedIntervalOption(val);
    if (val === 'custom') {
      const num = parseInt(customIntervalSeconds, 10) || 45;
      setAutoInterval(num);
      gaw.dropbox.setAutoSyncInterval(num);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gaw_dropbox_auto_sync_custom', String(num));
      }
      gaw.toast.info('Dropbox auto-sync custom interval set to ' + num + ' seconds');
    } else {
      const num = parseInt(val, 10);
      setAutoInterval(num);
      gaw.dropbox.setAutoSyncInterval(num);
      gaw.toast.info('Dropbox auto-sync interval set to ' + num + ' seconds');
    }
  };

  const handleApplyCustomInterval = () => {
    const num = Math.max(1, parseInt(customIntervalSeconds, 10) || 10);
    setCustomIntervalSeconds(String(num));
    setAutoInterval(num);
    gaw.dropbox.setAutoSyncInterval(num);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gaw_dropbox_auto_sync_custom', String(num));
    }
    gaw.toast.success('Dropbox auto-sync custom interval set to ' + num + ' seconds');
  };

  const handleToggleAuto = (enabled: boolean) => {
    setAutoEnabled(enabled);
    gaw.dropbox.setAutoSyncEnabled(enabled);
    gaw.toast.info('Dropbox cloud auto-sync ' + (enabled ? 'enabled' : 'disabled'));
  };

  const lastSyncDate = config.lastSyncTime ? new Date(config.lastSyncTime).toLocaleString() : 'Never synced in this session';

  return (
    <div className={'p-6 max-w-5xl mx-auto space-y-6 pb-28 ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
      {/* Top Banner */}
      <div className={'flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl shadow-xl backdrop-blur border ' + (
        isDark
          ? 'bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border-blue-800/50'
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
      )}>
        <div className="flex items-center gap-3.5">
          <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
            isDark ? 'bg-blue-600/30 border border-blue-500/40 text-blue-400' : 'bg-blue-100 border border-blue-300 text-blue-600'
          )}>
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Dropbox Cloud Synchronization</h1>
              {config.connected ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Disconnected
                </span>
              )}
            </div>
            <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-300' : 'text-slate-600')}>
              Securely synchronize your SQLite database file with your personal or enterprise Dropbox storage.
            </p>
          </div>
        </div>

        {/* Account / Disconnect */}
        {config.connected && (
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <p className={'font-semibold ' + (isDark ? 'text-white' : 'text-slate-900')}>{config.accountName || 'Dropbox User'}</p>
              <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{config.accountEmail || ''}</p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium transition active:scale-95"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className={'flex items-center gap-2 border-b pb-2 text-xs ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
        <button
          onClick={() => setActiveTab('sync')}
          className={'px-3 py-1.5 rounded-lg font-semibold transition ' + (
            activeTab === 'sync'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          Database Sync & Telemetry
        </button>
        <button
          onClick={() => setActiveTab('browser')}
          className={'px-3 py-1.5 rounded-lg font-semibold transition ' + (
            activeTab === 'browser'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          Dropbox File Browser ({remoteFiles.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={'px-3 py-1.5 rounded-lg font-semibold transition ' + (
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
        >
          Connection & API Keys
        </button>
      </div>

      {/* Tab 1: Database Sync & Telemetry */}
      {activeTab === 'sync' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card A: Active Database Status */}
          <div className={'p-5 rounded-xl space-y-4 border shadow-sm ' + (
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
          )}>
            <h2 className={'text-sm font-bold flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
              <Database className="w-4 h-4 text-blue-500" />
              <span>Active Database Telemetry</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80' : 'border-slate-100')}>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Database Name:</span>
                <span className={'font-mono font-semibold ' + (isDark ? 'text-white' : 'text-slate-900')}>{storageMeta.fileName}</span>
              </div>
              <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80' : 'border-slate-100')}>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Remote Dropbox Path:</span>
                <span className="font-mono text-blue-500 font-medium">
                  {gaw.dropbox.getCurrentRemoteFile()?.path_display || '/' + storageMeta.fileName}
                </span>
              </div>
              <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80' : 'border-slate-100')}>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Database Size:</span>
                <span className={'font-mono ' + (isDark ? 'text-slate-200' : 'text-slate-700')}>{(storageMeta.fileSize / 1024).toFixed(1)} KB</span>
              </div>
              <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80' : 'border-slate-100')}>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Last Synced to Dropbox:</span>
                <span className="font-mono text-emerald-500 font-medium">{lastSyncDate}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Internal State Tally:</span>
                <span className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase ' + (
                  storageMeta.hasUserModifications
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                )}>
                  {storageMeta.hasUserModifications ? 'Modified' : 'Unchanged'}
                </span>
              </div>
            </div>

            {/* Quick Actions: Save, Save as..., and Pull */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !config.connected}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow transition active:scale-95"
                title="Save database directly to Dropbox"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                onClick={handleSaveAs}
                disabled={isSaving || !config.connected}
                className={'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs border transition active:scale-95 ' + (
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                )}
                title="Save a copy of the database to Dropbox under a new name"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Save as...</span>
              </button>
              <button
                onClick={handlePullNow}
                disabled={isPulling || !config.connected}
                className={'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs border transition active:scale-95 ' + (
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                )}
                title="Pull and reconcile remote version from Dropbox"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>{isPulling ? 'Pulling...' : 'Pull'}</span>
              </button>
            </div>
          </div>

          {/* Card B: Auto-Sync Settings */}
          <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Automatic Sync Schedule</span>
            </h2>

            <p className="text-xs text-slate-400">
              When enabled and connected, background sync periodically checks external metrics, overwriting when internal has changes, reloading remote edits, and reconciling concurrent mutations.
            </p>

            <div className="space-y-4 pt-2">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Enable Cloud Auto-Sync</p>
                  <p className="text-[11px] text-slate-400">Periodically upload and reconcile changes while you work</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => handleToggleAuto(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>

              {autoEnabled && (
                <div className="space-y-2 pt-1">
                  <label className="text-xs text-slate-300 font-medium">Sync Frequency Interval:</label>
                  <select
                    value={selectedIntervalOption}
                    onChange={(e) => handleFrequencySelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="5">Every 5 seconds</option>
                    <option value="10">Every 10 seconds</option>
                    <option value="30">Every 30 seconds</option>
                    <option value="60">Every 60 seconds (1 minute)</option>
                    <option value="300">Every 5 minutes</option>
                    <option value="custom">Custom frequency...</option>
                  </select>

                  {selectedIntervalOption === 'custom' && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="number"
                        min="1"
                        max="86400"
                        value={customIntervalSeconds}
                        onChange={(e) => setCustomIntervalSeconds(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <span className="text-xs text-slate-400">seconds</span>
                      <button
                        onClick={handleApplyCustomInterval}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-[11px] text-blue-300 flex items-start gap-2">
                <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Automatic sync applies seamless overwrite to <code className="text-white font-mono">/{storageMeta.fileName}</code> if internal changes occurred without remote modifications.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Remote Dropbox File Browser */}
      {activeTab === 'browser' && (
        <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-400" />
                <span>Database Files on Dropbox</span>
              </h2>
              <p className="text-xs text-slate-400">Browse and open any SQLite database stored in your Dropbox account.</p>
            </div>
            <button
              onClick={loadRemoteFiles}
              disabled={loadingFiles || !config.connected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
            >
              <RefreshCw className={'w-3.5 h-3.5 ' + (loadingFiles ? 'animate-spin' : '')} />
              <span>Refresh Files</span>
            </button>
          </div>

          {!config.connected ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
              <Cloud className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p>Connect your Dropbox account in the "Connection & API Keys" tab to browse remote databases.</p>
            </div>
          ) : loadingFiles ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
              <p>Scanning Dropbox for SQLite databases...</p>
            </div>
          ) : remoteFiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
              <p>No SQLite files (*.db, *.sqlite, *.sqlite3) found in Dropbox root.</p>
              <button
                onClick={handlePushNow}
                className="mt-3 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold"
              >
                Upload Current Database as First File
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {remoteFiles.map((file) => (
                <div key={file.id} className="py-3 flex items-center justify-between hover:bg-slate-900/50 px-3 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">{file.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {(file.size / 1024).toFixed(1)} KB • Modified: {new Date(file.server_modified).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadRemoteFile(file)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition active:scale-95"
                  >
                    Open in Gawkyy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Connection & API Keys */}
      {activeTab === 'settings' && (
        <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <span>Dropbox API Credentials & Authentication</span>
          </h2>

          <div className="space-y-4 max-w-xl">
            {/* Method 1: Personal Access Token */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>Method 1: Direct Access Token (Instant)</span>
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Paste your Dropbox App Generated Access Token. This immediately connects Gawkyy directly to your Dropbox app folder without OAuth redirects.
              </p>

              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="sl.u.AFlk... or Dropbox Access Token"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                onClick={handleSaveToken}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition active:scale-95"
              >
                Save & Validate Access Token
              </button>
            </div>

            {/* Method 2: OAuth 2.0 PKCE */}
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Method 2: OAuth 2.0 App Key</span>
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter your Dropbox App Key to authenticate through Dropbox's official popup login screen.
              </p>

              <input
                type="text"
                placeholder="Dropbox App Key (Client ID)"
                value={clientIdInput}
                onChange={(e) => {
                  setClientIdInput(e.target.value);
                  gaw.dropbox.setClientId(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              />

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-medium">Redirect URI (add to Dropbox App Console):</label>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300">
                  <span className="flex-1 truncate select-all">{window.location.origin + '/'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + '/');
                      gaw.toast.info('Copied Redirect URI to clipboard!');
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!clientIdInput.trim()) {
                    gaw.toast.warning('Please enter your Dropbox App Key.');
                    return;
                  }
                  gaw.dropbox.initiateOAuthFlow(clientIdInput.trim(), window.location.origin + '/');
                }}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95"
              >
                Sign In With Dropbox OAuth
              </button>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl text-xs space-y-2 text-slate-400">
              <h3 className="font-semibold text-slate-200">How to get a free Dropbox API Key:</h3>
              <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                <li>Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-0.5">Dropbox App Console <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                <li>Click <strong>Create App</strong>, choose <strong>Scoped access</strong> &gt; <strong>App folder</strong>.</li>
                <li>Under <strong>Permissions</strong>, check <code className="text-slate-300">files.content.write</code> and <code className="text-slate-300">files.content.read</code>.</li>
                <li>Under the <strong>Settings</strong> tab, click <strong>Generate</strong> under Generated access token, and paste it above!</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

export const DEFAULT_LOCAL_STORAGE_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Save,
  FolderOpen,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Cloud,
  Layers,
  FileCheck
} from 'lucide-react';

export default function LocalStoragePlugin({ gaw }) {
  const [meta, setMeta] = useState(gaw.storage.getMetadata());
  const [autoInterval, setAutoInterval] = useState(meta.autoSyncIntervalSec || 30);
  const [autoEnabled, setAutoEnabled] = useState(meta.isAutoSyncEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [tableCount, setTableCount] = useState(0);

  const [selectedIntervalOption, setSelectedIntervalOption] = useState(() => {
    const std = [5, 10, 30, 60, 300];
    const sec = meta.autoSyncIntervalSec || 30;
    return std.includes(sec) ? String(sec) : 'custom';
  });
  const [customIntervalSeconds, setCustomIntervalSeconds] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gaw_local_auto_sync_custom');
      if (saved) return saved;
    }
    return String(meta.autoSyncIntervalSec || 15);
  });

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

  useEffect(() => {
    const unsub = gaw.storage.onStatusChange((newMeta) => {
      setMeta(newMeta);
      setAutoInterval(newMeta.autoSyncIntervalSec);
      setAutoEnabled(newMeta.isAutoSyncEnabled);
    });

    try {
      const res = gaw.db.queryObjects("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      setTableCount(res[0]?.count || 0);
    } catch (e) {}

    return unsub;
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ok = await gaw.storage.save();
      if (ok) {
        gaw.toast.success('Saved database changes to local file!');
      }
    } catch (err: any) {
      gaw.toast.error('Save failed: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAs = async () => {
    try {
      const ok = await gaw.storage.saveAs();
      if (ok) {
        gaw.toast.success('Saved new database copy to disk!');
      }
    } catch (err: any) {
      gaw.toast.error('Save As failed: ' + (err.message || String(err)));
    }
  };

  const handleOpenFile = async () => {
    try {
      const ok = await gaw.storage.openFile();
      if (ok) {
        gaw.workspace?.setSidebarOpen?.(true);
        gaw.toast.success('Opened local database file successfully!');
      }
    } catch (err: any) {
      gaw.toast.error('Failed to open file: ' + (err.message || String(err)));
    }
  };

  const handleExportDownload = () => {
    gaw.storage.exportDownload();
    gaw.toast.success('Exported and downloaded SQLite binary file.');
  };

  const handleFrequencySelect = (val: string) => {
    setSelectedIntervalOption(val);
    if (val === 'custom') {
      const num = parseInt(customIntervalSeconds, 10) || 15;
      setAutoInterval(num);
      gaw.storage.setAutoSyncInterval(num);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gaw_local_auto_sync_custom', String(num));
      }
      gaw.toast.info('Local auto-sync custom interval set to ' + num + ' seconds');
    } else {
      const num = parseInt(val, 10);
      setAutoInterval(num);
      gaw.storage.setAutoSyncInterval(num);
      gaw.toast.info('Local auto-sync interval set to ' + num + ' seconds');
    }
  };

  const handleApplyCustomInterval = () => {
    const num = Math.max(1, parseInt(customIntervalSeconds, 10) || 10);
    setCustomIntervalSeconds(String(num));
    setAutoInterval(num);
    gaw.storage.setAutoSyncInterval(num);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gaw_local_auto_sync_custom', String(num));
    }
    gaw.toast.success('Local auto-sync custom interval set to ' + num + ' seconds');
  };

  const handleToggleAuto = (enabled: boolean) => {
    setAutoEnabled(enabled);
    gaw.storage.setAutoSyncEnabled(enabled);
    gaw.toast.info('Local file auto-sync ' + (enabled ? 'enabled' : 'disabled'));
  };

  const lastSavedFormatted = meta.lastSavedAt
    ? new Date(meta.lastSavedAt).toLocaleString()
    : 'Not yet saved in this session';

  return (
    <div className={'p-6 max-w-5xl mx-auto space-y-6 pb-28 ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
      {/* Top Banner */}
      <div className={'flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl shadow-xl backdrop-blur border ' + (
        isDark
          ? 'bg-gradient-to-r from-emerald-950/70 to-slate-900 border-emerald-800/50'
          : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
      )}>
        <div className="flex items-center gap-3.5">
          <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
            isDark ? 'bg-emerald-600/30 border border-emerald-500/40 text-emerald-400' : 'bg-emerald-100 border border-emerald-300 text-emerald-600'
          )}>
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Local File Storage & Disk Sync</h1>
              {meta.hasFileHandle ? (
                <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ' + (
                  isDark ? 'bg-emerald-950 border-emerald-700/60 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                )}>
                  <FileCheck className="w-3 h-3" /> Disk Handle Attached
                </span>
              ) : (
                <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ' + (
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-200 border-slate-300 text-slate-700'
                )}>
                  Session Only
                </span>
              )}
            </div>
            <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-300' : 'text-slate-600')}>
              Directly synchronize SQLite changes with your local file system, configure auto-sync intervals, and open databases.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenFile}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition active:scale-95"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Open Local Database...</span>
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Storage Telemetry */}
        <div className={'p-5 rounded-xl space-y-4 border ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          <h2 className={'text-sm font-bold flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Database Storage Telemetry</span>
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500')}>
              <span>File Name:</span>
              <span className={'font-mono font-semibold ' + (isDark ? 'text-white' : 'text-slate-900')}>{meta.fileName}</span>
            </div>
            <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500')}>
              <span>File Handle Path:</span>
              <span className="font-mono text-emerald-500 truncate max-w-[220px]">
                {meta.filePath || (meta.hasFileHandle ? 'Active OS File Handle' : 'In-Memory WebAssembly')}
              </span>
            </div>
            <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500')}>
              <span>File Size on Disk:</span>
              <span className={'font-mono ' + (isDark ? 'text-slate-200' : 'text-slate-700')}>{(meta.fileSize / 1024).toFixed(1)} KB</span>
            </div>
            <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500')}>
              <span>Active Tables:</span>
              <span className={'font-mono ' + (isDark ? 'text-slate-200' : 'text-slate-700')}>{tableCount} tables</span>
            </div>
            <div className={'flex justify-between items-center py-1 border-b ' + (isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-100 text-slate-500')}>
              <span>Last Saved to Disk:</span>
              <span className="font-mono text-emerald-500">{lastSavedFormatted}</span>
            </div>
            <div className={'flex justify-between items-center py-1 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
              <span>Internal State Tally:</span>
              <span className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase ' + (
                meta.hasUserModifications
                  ? isDark ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  : isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              )}>
                {meta.hasUserModifications ? 'Modified' : 'Unchanged'}
              </span>
            </div>
          </div>

          {/* Quick Actions: Save, Save as..., and Export */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs shadow transition active:scale-95"
              title="Save active database to disk without holding a write lock"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
            <button
              onClick={handleSaveAs}
              className={'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs border transition active:scale-95 ' + (
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
              )}
              title="Save a copy of the database to disk under a new name"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Save as...</span>
            </button>
            <button
              onClick={handleExportDownload}
              className={'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs border transition active:scale-95 ' + (
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
              )}
              title="Download raw .db binary file directly"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .db</span>
            </button>
          </div>
        </div>

        {/* Card 2: Auto-Save Engine Configuration */}
        <div className={'p-5 rounded-xl space-y-4 border ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          <h2 className={'text-sm font-bold flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Local Auto-Sync Engine</span>
          </h2>

          <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
            When enabled and a file handle is attached, Gawkyy periodically checks external file metrics, overwrites when internal has changes, reloads external edits, and reconciles concurrent mutations.
          </p>

          <div className="space-y-4 pt-2">
            <label className={'flex items-center justify-between p-3 rounded-lg border cursor-pointer ' + (
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            )}>
              <div>
                <p className={'text-xs font-semibold ' + (isDark ? 'text-white' : 'text-slate-900')}>Enable Local Auto-Sync</p>
                <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Automatically check and synchronize changes with local disk</p>
              </div>
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => handleToggleAuto(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
              />
            </label>

            {autoEnabled && (
              <div className="space-y-2 pt-1">
                <label className={'text-xs font-medium ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Sync Frequency Interval:</label>
                <select
                  value={selectedIntervalOption}
                  onChange={(e) => handleFrequencySelect(e.target.value)}
                  className={'w-full px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-emerald-500 border ' + (
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                  )}
                >
                  <option value="5">Every 5 seconds</option>
                  <option value="10">Every 10 seconds</option>
                  <option value="30">Every 30 seconds</option>
                  <option value="60">Every 60 seconds (1 minute)</option>
                  <option value="300">Every 5 minutes</option>
                  <option value="custom">Custom frequency...</option>
                </select>

                {selectedIntervalOption === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="1"
                      max="86400"
                      value={customIntervalSeconds}
                      onChange={(e) => setCustomIntervalSeconds(e.target.value)}
                      placeholder="e.g. 15"
                      className={'w-24 px-2.5 py-1.5 rounded-lg border text-xs font-mono focus:outline-none focus:border-emerald-500 ' + (
                        isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                      )}
                    />
                    <span className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>seconds</span>
                    <button
                      onClick={handleApplyCustomInterval}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition active:scale-95"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className={'p-3 rounded-lg text-[11px] space-y-1 border ' + (
              isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            )}>
              <p className={'font-semibold ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>PWA File System Access Note:</p>
              <p>
                Gawkyy maintains ongoing read-write access to your local database file without holding a persistent write lock, allowing smooth concurrent access and automated 4-way sync.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

export const DEFAULT_HELP_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Sparkles,
  Download,
  Smartphone,
  Keyboard,
  Cloud,
  Shield,
  ExternalLink,
  Code2,
  Database,
  BookOpen,
  Cpu,
  Layers,
  Terminal,
  FileCode,
  CheckCircle2,
  Puzzle,
  Table,
  FileSpreadsheet,
  BarChart3,
  Github,
  Info,
  FolderOpen,
  HardDrive,
  Save,
  RefreshCw,
  Play,
  Copy,
  Check,
  Settings,
  Zap,
  Globe,
  FileText,
  Lightbulb,
  Workflow,
  ListOrdered
} from 'lucide-react';

export default function HelpPlugin({ gaw }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedCode, setCopiedCode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

  const sampleBoilerplate = [
    "import React, { useState, useEffect } from 'react';",
    "import { Database, Sparkles, RefreshCw } from 'lucide-react';",
    "",
    "export default function MyCustomPlugin({ gaw }) {",
    "  const [rows, setRows] = useState([]);",
    "  const [loading, setLoading] = useState(false);",
    "",
    "  const loadData = () => {",
    "    try {",
    "      setLoading(true);",
    "      // Query SQLite database objects",
    "      const result = gaw.db.queryObjects('SELECT * FROM t_settings LIMIT 20;');",
    "      setRows(result || []);",
    "      gaw.toast.success('Loaded ' + (result?.length || 0) + ' records from SQLite!');",
    "    } catch (err) {",
    "      gaw.toast.error('Query error: ' + (err.message || String(err)));",
    "    } finally {",
    "      setLoading(false);",
    "    }",
    "  };",
    "",
    "  useEffect(() => {",
    "    loadData();",
    "  }, []);",
    "",
    "  return (",
    '    <div className="p-6 max-w-4xl mx-auto space-y-4">',
    '      <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-900 border-slate-800">',
    '        <h2 className="text-base font-bold text-white flex items-center gap-2">',
    '          <Sparkles className="w-5 h-5 text-indigo-400" />',
    '          <span>My Custom SQLite Plugin</span>',
    '        </h2>',
    '        <button',
    '          onClick={loadData}',
    '          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"',
    '        >',
    "          <RefreshCw className={'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '')} />",
    '          <span>Refresh</span>',
    '        </button>',
    '      </div>',
    '',
    '      <div className="border rounded-xl p-4 bg-slate-950/70 border-slate-800 text-xs text-slate-300 font-mono">',
    '        <pre>{JSON.stringify(rows, null, 2)}</pre>',
    '      </div>',
    '    </div>',
    '  );',
    '}'
  ].join(String.fromCharCode(10));

  const sampleReportSql1 = [
    'SELECT',
    '  c.name AS category_name,',
    '  COUNT(p.id) AS product_count,',
    '  SUM(p.units_in_stock) AS total_inventory,',
    '  ROUND(SUM(p.units_in_stock * p.unit_price), 2) AS gross_inventory_value,',
    '  ROUND(AVG(p.unit_price), 2) AS avg_unit_price',
    'FROM categories c',
    'JOIN products p ON p.category_id = c.id',
    'GROUP BY c.id, c.name',
    'ORDER BY gross_inventory_value DESC;'
  ].join(String.fromCharCode(10));

  const sampleReportSql2 = [
    'SELECT',
    '  c.company_name,',
    '  c.country,',
    '  COUNT(o.id) AS total_orders,',
    '  ROUND(SUM(o.total_amount), 2) AS lifetime_value,',
    '  ROUND(AVG(o.total_amount), 2) AS avg_order_value,',
    '  MAX(o.order_date) AS last_purchase_date',
    'FROM customers c',
    'LEFT JOIN orders o ON o.customer_id = c.id',
    'GROUP BY c.id',
    'ORDER BY lifetime_value DESC',
    'LIMIT 25;'
  ].join(String.fromCharCode(10));

  const sampleReportSql3 = [
    'SELECT',
    '  id,',
    '  name,',
    '  version,',
    "  CASE WHEN enabled = 1 THEN 'Active' ELSE 'Disabled' END AS status,",
    '  menu_category,',
    '  route,',
    '  created_at',
    'FROM t_plugins',
    'ORDER BY menu_category, name;'
  ].join(String.fromCharCode(10));

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sampleBoilerplate);
    setCopiedCode(true);
    gaw.toast.success('Plugin boilerplate copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const technologies = [
    {
      name: 'TypeScript',
      badge: 'Language',
      url: 'https://www.typescriptlang.org/',
      desc: 'Strongly typed superset of JavaScript providing compile-time type safety, intellisense, and high reliability across the application core.',
      icon: Code2,
    },
    {
      name: 'React 19',
      badge: 'UI Framework',
      url: 'https://react.dev/',
      desc: 'Declarative component architecture powering interactive workspaces, reactive data streams, and client-side plugin hosts.',
      icon: Zap,
    },
    {
      name: 'SQLite',
      badge: 'Database Engine',
      url: 'https://www.sqlite.org/',
      desc: 'The world database engine: self-contained, transactional SQL database engine. Stores your schema, records, settings, and plugins in a single binary file.',
      icon: Database,
    },
    {
      name: 'sql.js (WebAssembly SQLite)',
      badge: 'Wasm Runtime',
      url: 'https://sql.js.org/',
      desc: 'Official WebAssembly port of SQLite compiled using Emscripten, enabling full native SQL execution entirely inside client browser memory with zero server dependencies.',
      icon: Cpu,
    },
    {
      name: 'Dropbox API',
      badge: 'Cloud Sync',
      url: 'https://www.dropbox.com/developers',
      secondaryUrl: 'https://www.dropbox.com/developers/apps',
      secondaryLabel: 'App Console',
      desc: 'Secure cloud file storage integration leveraging PKCE OAuth authentication, metadata inspection, and delta file uploads/downloads.',
      icon: Cloud,
    },
    {
      name: 'Progressive Web App (PWA)',
      badge: 'Web Standard',
      url: 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps',
      desc: 'Enables 100% offline functionality, service worker asset precaching, background sync, and native installation on Windows, macOS, iPadOS, iOS, and Android.',
      icon: Smartphone,
    },
    {
      name: 'File System Access API',
      badge: 'Web Standard',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API',
      desc: 'Modern web API granting ongoing read-write access to local disk SQLite files without persistent write locks, allowing concurrent access and background synchronization.',
      icon: HardDrive,
    },
    {
      name: 'HTML5 Standards',
      badge: 'Web Standard',
      url: 'https://developer.mozilla.org/en-US/docs/Web/HTML',
      desc: 'Modern semantic structure, drag-and-drop file readers, IndexedDB storage containers, and binary ArrayBuffer processing.',
      icon: Globe,
    },
    {
      name: 'CSS3 & Tailwind CSS',
      badge: 'Styling',
      url: 'https://tailwindcss.com/',
      secondaryUrl: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
      secondaryLabel: 'MDN CSS3',
      desc: 'Utility-first styling framework delivering high-density enterprise layouts, dark/light themes, and responsive design across desktop and mobile.',
      icon: Layers,
    },
    {
      name: 'JavaScript (ES2022+)',
      badge: 'Runtime',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      desc: 'Modern asynchronous JavaScript including async/await, BroadcastChannel cross-tab synchronization, and binary Uint8Array streams.',
      icon: Terminal,
    },
    {
      name: 'Monaco Editor (Internal IDE)',
      badge: 'Code Editor',
      url: 'https://microsoft.github.io/monaco-editor/',
      desc: 'The professional code editor that powers Visual Studio Code, integrated into Gawkyy with TypeScript syntax highlighting, intellisense, and code folding.',
      icon: FileCode,
    },
    {
      name: 'Sucrase TSX Transpiler',
      badge: 'Compiler',
      url: 'https://sucrase.io/',
      desc: 'Blazing fast in-browser TypeScript and JSX compiler transforming live plugin code into executable JavaScript in milliseconds.',
      icon: Sparkles,
    },
    {
      name: 'Lucide React Icons',
      badge: 'Iconography',
      url: 'https://lucide.dev/',
      desc: 'Consistent, clean, customizable SVG icon library with hundreds of icons available directly to plugins and host components.',
      icon: CheckCircle2,
    },
    {
      name: 'Vite & Rollup',
      badge: 'Build Tool',
      url: 'https://vitejs.dev/',
      desc: 'Next-generation frontend tooling providing instant server start, optimized production bundles, and PWA workbox service worker compilation.',
      icon: Zap,
    },
    {
      name: 'Spreadsheet Studio Calculation Engine',
      badge: 'Core Feature',
      desc: 'In-memory multi-sheet reactive calculation grid supporting formulas (=SUM, =AVERAGE, =MIN, =MAX, =COUNT, =IF, math operations), cell coordinate mapping (A1:Z100), CSV export, and live SQL query synchronization.',
      icon: FileSpreadsheet,
    },
    {
      name: 'Visual Report Generator and Designer',
      badge: 'Core Feature',
      desc: 'Reactive SQL aggregation and publication reporting engine supporting KPI scorecards, multi-column summary tables, custom SQL projections, charts, and print/PDF formatting.',
      icon: BarChart3,
    },
    {
      name: 'Google AI Studio',
      badge: 'Build Environment',
      url: 'https://aistudio.google.com/',
      desc: 'Gawkyy was conceived, architected, and engineered with Google AI Studio. This application project is public on AI Studio so developers worldwide can clone, inspect, prompt, and extend it directly!',
      icon: Sparkles,
    },
    {
      name: 'GitHub Open Source Repository',
      badge: 'Source Code',
      url: 'https://github.com/davidgma/generic-application-wrapper',
      desc: 'The official public open-source repository for Gawkyy. Explore the codebase, report issues, submit pull requests, and contribute to the project.',
      icon: Github,
    },
  ];

  return (
    <div className={'flex-1 overflow-y-auto p-4 md:p-6 select-text transition-colors ' + (
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    )}>
      <div className="max-w-5xl mx-auto space-y-6 pb-28">
        {/* Top Header Card */}
        <div className={'p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ' + (
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <div className="flex items-center gap-3.5">
            <div className={'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ' + (
              isDark ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            )}>
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>
                  Help, Technologies & Documentation
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Core Plugin
                </span>
              </div>
              <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                Comprehensive manual, technology reference with official sources, plugin development guide, and application walkthrough.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="https://github.com/davidgma/generic-application-wrapper"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 shadow transition active:scale-95"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Studio</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={'flex items-center gap-2 border-b pb-2 text-xs overflow-x-auto ' + (isDark ? 'border-slate-800' : 'border-slate-200')}>
          {[
            { id: 'overview', label: 'Overview & Tools', icon: Info },
            { id: 'tech', label: 'Technology Stack (' + technologies.length + ')', icon: Cpu },
            { id: 'plugins', label: 'Plugin Developer Guide', icon: Code2 },
            { id: 'guide', label: 'Application User Guide', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={'flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap active:scale-95 ' + (
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Overview & Quick Tools */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Primary Action Cards: AI Spec Generator + PWA Installation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. AI Specification Generator */}
              <div className={'p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.005] ' + (
                isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
              )}>
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>AI Specification Generator</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Prompt Exporter
                      </span>
                    </h3>
                    <p className={'text-xs mt-1 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                      Generate customized engineering prompts embedded with your active SQLite schema and the Gawkyy TypeScript SDK.
                      Paste into Gemini, Claude, or ChatGPT to generate dynamic plugins instantly.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (gaw.navigation.openAI) {
                      gaw.navigation.openAI();
                    } else {
                      gaw.toast.info('Opening AI Prompt Exporter from main menu...');
                    }
                  }}
                  className="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch AI Prompt Generator</span>
                </button>
              </div>

              {/* 2. Install App as PWA */}
              <div className={'p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.005] ' + (
                isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
              )}>
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Install Gawkyy as PWA</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        100% Offline Ready
                      </span>
                    </h3>
                    <p className={'text-xs mt-1 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                      Install Gawkyy on your PC, Mac, iPad, iPhone, or Android device as a standalone desktop app.
                      Once installed, it operates with zero internet requirement and direct access to your local SQLite file system.
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-2.5 rounded-xl border bg-slate-900/50 border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">PWA Desktop / Mobile Standalone</span>
                  <button
                    onClick={() => gaw.toast.info('Click the browser install icon in the URL bar, or choose "Install Gawkyy" from browser settings.')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install Instructions</span>
                  </button>
                </div>
              </div>
            </div>

            {/* About Gawkyy Card */}
            <div className={'p-5 rounded-2xl border shadow-sm ' + (
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
            )}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <img
                  src="/gawkyy-cat-256x256.png"
                  alt="Gawkyy Mascot"
                  className="w-16 h-16 rounded-2xl object-cover shadow-md ring-2 ring-amber-400/40 flex-shrink-0"
                />
                <div className="space-y-1">
                  <h3 className={'text-base font-bold flex items-center gap-2 ' + (isDark ? 'text-sky-300' : 'text-blue-700')}>
                    <span>Gawkyy — Generic Application Wrapper</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono font-normal">
                      v1.2.0
                    </span>
                  </h3>
                  <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                    A web-native, offline-first portable application platform and MS Access successor. Built on client-side WebAssembly SQLite,
                    in-browser Sucrase TSX compilation, reactive Excel-compatible spreadsheets, and automated 4-way conflict reconciliation.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-indigo-400">
                    <span>• sql.js WebAssembly SQLite</span>
                    <span>• Sucrase Fast TSX Compiler</span>
                    <span>• PWA File System Access API</span>
                    <span>• Dropbox PKCE Cloud Sync</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts Reference */}
            <div className={'p-5 rounded-2xl border shadow-sm ' + (
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
            )}>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800/40">
                <Keyboard className="w-4 h-4 text-indigo-400" />
                <h3 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-sky-300/90' : 'text-blue-700')}>
                  Keyboard Shortcuts Reference
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 text-xs">
                {[
                  ['Ctrl + Shift + F', 'Toggle Full Monaco IDE Mode / Gawkyy Shell'],
                  ['Ctrl + O', 'Open Local SQLite Database File'],
                  ['Ctrl + S', 'Save Active Database to Disk / Cloud'],
                  ['Ctrl + Enter', 'Run SQL Query / Test Plugin in IDE'],
                  ['Shift + Alt + F', 'Format Document (Prettier Auto-format)'],
                  ['Ctrl + B', 'Toggle Navigation Side Bar'],
                ].map(([shortcut, desc], idx) => (
                  <div
                    key={idx}
                    className={'p-2.5 rounded-xl border flex items-center justify-between gap-3 ' + (
                      isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                    )}
                  >
                    <span className={'text-[11px] ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{desc}</span>
                    <kbd className="px-2 py-1 rounded bg-black/40 text-sky-300 font-mono text-[10px] font-bold border border-white/10 flex-shrink-0">
                      {shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Cloud Sync Quick Link */}
            <div className={'p-5 rounded-2xl border shadow-sm flex items-center justify-between gap-4 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
            )}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Dropbox Cloud Synchronization</h3>
                  <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Synchronize SQLite databases across devices using Dropbox OAuth PKCE authentication and 4-way delta reconciliation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => gaw.navigation.openPlugin('plugin_dropbox_sync')}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center gap-1.5 flex-shrink-0"
              >
                <span>Open Cloud Sync</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Technology Stack & Official References */}
        {activeTab === 'tech' && (
          <div className="space-y-4">
            <div className={'p-4 rounded-xl border ' + (isDark ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800')}>
              <p className="text-xs leading-relaxed">
                Gawkyy is built with open web standards and proven open-source technologies. Below is the complete catalog of core libraries,
                database engines, compilers, and APIs powering the platform, along with direct links to official documentation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {technologies.map((t, idx) => (
                <div
                  key={idx}
                  className={'p-4 rounded-2xl border flex flex-col justify-between transition hover:border-indigo-500/50 shadow-sm ' + (
                    isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ' + (
                          isDark ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
                        )}>
                          <t.icon className="w-4 h-4" />
                        </div>
                        <h4 className={'text-xs font-bold truncate ' + (isDark ? 'text-white' : 'text-slate-900')}>
                          {t.name}
                        </h4>
                      </div>
                      <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ' + (
                        isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-300'
                      )}>
                        {t.badge}
                      </span>
                    </div>

                    <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      {t.desc}
                    </p>
                  </div>

                  <div className={'flex items-center gap-2 pt-3 mt-2 border-t ' + (isDark ? 'border-slate-800/40' : 'border-slate-200')}>
                    {t.url && (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 transition"
                      >
                        <span>Official Docs</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {t.secondaryUrl && (
                      <>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>•</span>
                        <a
                          href={t.secondaryUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 transition"
                        >
                          <span>{t.secondaryLabel || 'Secondary Link'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Plugin Developer Guide */}
        {activeTab === 'plugins' && (
          <div className="space-y-6">
            {/* Intro Card */}
            <div className={'p-5 rounded-2xl border space-y-2 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
            )}>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Code2 className="w-5 h-5" />
                <h3 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Plugin Architecture & Execution Model</h3>
              </div>
              <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                In Gawkyy, plugins are first-class applications stored directly inside the SQLite database in the <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-indigo-300 bg-slate-900' : 'text-indigo-800 bg-slate-100 border border-slate-200')}>t_plugins</code> table.
                Each plugin is written in React (TSX) and receives the global <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-sky-300 bg-slate-900' : 'text-sky-800 bg-slate-100 border border-slate-200')}>gaw</code> context object.
                Plugins are dynamically compiled client-side in milliseconds via Sucrase, hot-reloaded automatically, and isolated inside React Error Boundaries (Plugin Safe Mode).
              </p>
            </div>

            {/* Boilerplate Section */}
            <div className={'p-5 rounded-2xl border space-y-3 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-indigo-400' : 'text-indigo-700')}>Starter Plugin Boilerplate</h4>
                  <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>Copy and paste this standard template into the Internal Monaco IDE:</p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-72">
                <pre>{sampleBoilerplate}</pre>
              </div>
            </div>

            {/* gaw Context API Reference Table */}
            <div className={'p-5 rounded-2xl border space-y-4 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
            )}>
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-white' : 'text-slate-900')}>
                  The <code className={'font-mono ' + (isDark ? 'text-indigo-400' : 'text-indigo-700')}>gaw</code> Context API Reference
                </h4>
              </div>

              <div className={'divide-y text-xs ' + (isDark ? 'divide-slate-800/60' : 'divide-slate-200')}>
                {[
                  ['gaw.db.query(sql, params)', 'Executes a SQL query and returns { columns: string[], values: any[][] }.'],
                  ['gaw.db.queryObjects(sql, params)', 'Executes SQL and returns typed array of JavaScript objects [ { id: 1, ... } ].'],
                  ['gaw.db.execute(sql)', 'Executes multi-statement SQL scripts (DDL/DML) and notifies subscribers of mutations.'],
                  ['gaw.db.getTables()', 'Returns array of user table names in the active SQLite database.'],
                  ['gaw.db.getSchema()', 'Returns detailed table column metadata, primary keys, and types.'],
                  ['gaw.toast.success(msg) / .error / .warning / .info', 'Displays floating non-blocking notification alerts.'],
                  ['gaw.dialog.confirm(message)', 'Prompts user with asynchronous confirm modal returning Promise<boolean>.'],
                  ['gaw.dialog.prompt(message, defaultVal)', 'Prompts user for input returning Promise<string | null>.'],
                  ['gaw.navigation.navigate(route)', 'Switches views (e.g. "view", "database", "ide", "spreadsheet", "plugin:id").'],
                  ['gaw.navigation.openSpreadsheet(data, name)', 'Pushes dataset directly into Spreadsheet Studio workbook tab.'],
                  ['gaw.navigation.openIDE(tab)', 'Opens the Internal Monaco IDE focused on a specific plugin or query.'],
                  ['gaw.navigation.openAI()', 'Launches the AI Specification Generator modal.'],
                  ['gaw.eventBus.on(event, cb) / .emit(event, ...args)', 'Decoupled pub/sub event bus for plugin-to-plugin real-time events.'],
                  ['gaw.storage.save() / .saveAs()', 'Saves active database to local disk without persistent write locks.'],
                  ['gaw.dropbox.save() / .saveAs()', 'Saves active database to Dropbox cloud account.'],
                  ['gaw.theme', 'Current theme ("vs-dark" | "vs-light") to match system aesthetics.'],
                ].map(([api, desc], i) => (
                  <div key={i} className="py-2.5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <code className={'font-mono text-[11px] font-semibold ' + (isDark ? 'text-sky-300' : 'text-indigo-900')}>{api}</code>
                    <span className={'text-xs sm:text-right max-w-md ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step-by-Step Creation Walkthrough */}
            <div className={'p-5 rounded-2xl border space-y-3 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
            )}>
              <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-indigo-400' : 'text-indigo-700')}>Step-by-Step: Creating a New Plugin</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <div className={'flex items-center gap-2 font-bold ' + (isDark ? 'text-slate-200' : 'text-slate-900')}>
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>Create Plugin Record</span>
                  </div>
                  <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Click <strong>Add Plugin</strong> in the left sidebar or launch the Plugin Manager. Give it an ID (e.g. <code className={'font-mono font-semibold ' + (isDark ? 'text-indigo-300' : 'text-indigo-700')}>plugin_analytics</code>) and title.
                  </p>
                </div>

                <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <div className={'flex items-center gap-2 font-bold ' + (isDark ? 'text-slate-200' : 'text-slate-900')}>
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>Write TSX Component</span>
                  </div>
                  <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Click the three dots <strong>(···)</strong> next to your plugin and choose <strong>Edit in IDE</strong>. Write your standard React component with state, hooks, and SQL calls.
                  </p>
                </div>

                <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <div className={'flex items-center gap-2 font-bold ' + (isDark ? 'text-slate-200' : 'text-slate-900')}>
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>Hot Reload & Testing</span>
                  </div>
                  <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Press <kbd className={'font-mono font-semibold px-1 py-0.5 rounded text-[10px] ' + (isDark ? 'bg-black/40 text-sky-300 border border-white/10' : 'bg-slate-200 text-slate-800 border border-slate-300')}>Ctrl + S</kbd> to save. The plugin renders live in the right preview canvas. If an error occurs, Plugin Safe Mode isolates it cleanly.
                  </p>
                </div>

                <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <div className={'flex items-center gap-2 font-bold ' + (isDark ? 'text-slate-200' : 'text-slate-900')}>
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">4</span>
                    <span>Export & Share</span>
                  </div>
                  <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Save your database locally or to Dropbox. Your plugin code travels inside the <code className={'font-mono font-semibold ' + (isDark ? 'text-indigo-300' : 'text-indigo-700')}>.sqlite</code> binary file to any device running Gawkyy!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Application User Guide */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            {/* Feature 1: Database Studio & Table Editor */}
            <div className={'p-5 rounded-2xl border space-y-3 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
            )}>
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Database className="w-5 h-5" />
                <h3 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>1. Database Studio & Table Editor</h3>
              </div>
              <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                Gawkyy provides a comprehensive client-side database management suite running directly on WebAssembly SQLite in browser memory:
              </p>
              <ul className={'list-disc pl-5 space-y-1.5 text-xs ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Visual Schema Inspection</strong>: Inspect column names, SQLite data types (INTEGER, TEXT, REAL, BLOB), PRIMARY KEY constraints, and NOT NULL flags.</li>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Interactive Table Grid</strong>: Fast searchable and paginated grid. Double-click table cells to edit values inline with immediate transactional persistence.</li>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>SQL Console & Scratchpad</strong>: Write and execute arbitrary DDL (CREATE, ALTER, DROP) and DML (INSERT, UPDATE, DELETE) statements with millisecond execution profiling.</li>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Data Export & Import</strong>: Export table records to CSV or JSON with one click, or download the full raw binary <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-indigo-300 bg-slate-900' : 'text-indigo-800 bg-slate-100 border border-slate-200')}>.sqlite</code> file.</li>
              </ul>
            </div>

            {/* Feature 2: Visual Report Generator and Designer */}
            <div className={'p-6 rounded-2xl border space-y-5 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
            )}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
                  <BarChart3 className="w-6 h-6" />
                  <div>
                    <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>
                      2. Visual Report Generator and Designer
                    </h3>
                    <p className={'text-xs ' + (isDark ? 'text-purple-300/80' : 'text-purple-800')}>
                      Publication-grade executive reports, KPI scorecards, SVG charts & print-ready PDF export
                    </p>
                  </div>
                </div>
                <span className={'px-2.5 py-1 rounded-full text-[11px] font-semibold ' + (
                  isDark ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60' : 'bg-purple-50 text-purple-800 border border-purple-200'
                )}>
                  Core Architecture
                </span>
              </div>

              {/* Overview & Mission */}
              <div className="space-y-2">
                <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-purple-400' : 'text-purple-800')}>
                  Overview & Design Philosophy
                </h4>
                <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                  The <strong>Visual Report Generator</strong> is Gawkyy's modern successor to Microsoft Access Reports and Crystal Reports.
                  Rather than forcing you to export data into external BI tools or spreadsheets to assemble management summaries, Gawkyy allows you to bind live SQLite SQL queries directly to beautiful, publication-ready executive documents that execute entirely inside your browser.
                </p>
                <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                  Every report is fully reactive: opening a report or clicking <strong>Refresh Data</strong> re-executes the underlying SQL against the active SQLite database in real time.
                  Reports are stored as structured JSON configurations inside the SQLite database itself (<code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-purple-300 bg-slate-900' : 'text-purple-800 bg-slate-100 border border-slate-200')}>t_reports</code>), so every visual report travels seamlessly across devices inside your portable <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-purple-300 bg-slate-900' : 'text-purple-800 bg-slate-100 border border-slate-200')}>.sqlite</code> file.
                </p>
              </div>

              {/* 6 Core Components Breakdown */}
              <div className="space-y-3">
                <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-purple-400' : 'text-purple-800')}>
                  The 6 Core Visual Report Elements
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className={'font-bold flex items-center gap-1.5 ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>
                      <span className="text-purple-600 dark:text-purple-400 font-mono">1.</span>
                      <span>Corporate Header & Metadata</span>
                    </div>
                    <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      Configurable organization branding, report title, subtitle, generation date, reporting period badge (e.g. "Q3 FY2026"), author attribution, and official confidentiality tags.
                    </p>
                  </div>

                  <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className={'font-bold flex items-center gap-1.5 ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>
                      <span className="text-purple-600 dark:text-purple-400 font-mono">2.</span>
                      <span>KPI Highlight Scorecards</span>
                    </div>
                    <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      Executive summary cards highlighting aggregate metrics with automatic formatting: <strong>currency</strong> ($1,250,000.00), <strong>percent</strong> (18.4%), <strong>number</strong> (4,520), or <strong>text</strong>, plus contextual subtitles.
                    </p>
                  </div>

                  <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className={'font-bold flex items-center gap-1.5 ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>
                      <span className="text-purple-600 dark:text-purple-400 font-mono">3.</span>
                      <span>Proportional Vector SVG Charts</span>
                    </div>
                    <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      Clean vector bar charts, line graphs, and donut charts. Maps SQL category columns to numeric metric values with custom brand color palettes and proportional distribution bars.
                    </p>
                  </div>

                  <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className={'font-bold flex items-center gap-1.5 ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>
                      <span className="text-purple-600 dark:text-purple-400 font-mono">4.</span>
                      <span>Tabular Data Breakdown</span>
                    </div>
                    <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      Multi-column breakdown tables. Numeric metrics automatically align right in monospace font for accounting precision; nulls display em-dashes (—); optional total summary rows.
                    </p>
                  </div>

                  <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className={'font-bold flex items-center gap-1.5 ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>
                      <span className="text-purple-600 dark:text-purple-400 font-mono">5.</span>
                      <span>Executive Commentary & Audit Notes</span>
                    </div>
                    <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      Prominent memo callout block positioned at the conclusion of the report for auditor remarks, qualitative commentary, strategic recommendations, or data provenance disclaimers.
                    </p>
                  </div>

                  <div className={'p-3.5 rounded-xl border space-y-1 ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                    <div className={'font-bold flex items-center gap-1.5 ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>
                      <span className="text-purple-600 dark:text-purple-400 font-mono">6.</span>
                      <span>Zero-Watermark Print & PDF Engine</span>
                    </div>
                    <p className={'text-[11px] leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                      Click <strong>Print / Save as PDF</strong> to generate print-ready documents. Uses tailored @media print CSS to strip web navigation, headers, and UI controls for formal presentation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step-by-Step Workflow */}
              <div className="space-y-3">
                <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-purple-400' : 'text-purple-800')}>
                  Step-by-Step: Designing a Custom Report
                </h4>
                <ol className={'list-decimal pl-5 space-y-2 text-xs ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                  <li>
                    <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Formulate Your SQL Query</strong>:
                    In the Query Studio or SQL Console, formulate and test your aggregation query. Use descriptive aliases (e.g. <code className="font-mono text-indigo-600 dark:text-indigo-300">AS total_revenue</code>, <code className="font-mono text-indigo-600 dark:text-indigo-300">AS units_sold</code>) so columns are intuitive when configuring report widgets.
                  </li>
                  <li>
                    <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Create the Report Entry</strong>:
                    Navigate to <strong>Reports</strong> in the left sidebar and click <strong>Add Report (+)</strong> or select an existing report and click <strong>Customize Report</strong>.
                  </li>
                  <li>
                    <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Bind Data Source & Configure Metadata</strong>:
                    Select your saved query from the dropdown or provide custom SQL. Specify the Report Title, Subtitle, Company Name, and Period text.
                  </li>
                  <li>
                    <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Add KPI Cards & Charts</strong>:
                    Select which numeric column feeds each KPI card and specify formatting (currency, percent, or number). Map category label columns and numerical value columns to generate SVG bar charts with your preferred hex color.
                  </li>
                  <li>
                    <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Save to SQLite & Deliver</strong>:
                    Click <strong>Save Report</strong>. Gawkyy serializes the design directly into <code className="font-mono text-indigo-600 dark:text-indigo-300">t_reports</code>. Click <strong>Print / Save as PDF</strong> anytime to produce an executive document.
                  </li>
                </ol>
              </div>

              {/* Detailed Real-World Examples */}
              <div className="space-y-4">
                <h4 className={'text-xs font-bold uppercase tracking-wider ' + (isDark ? 'text-purple-400' : 'text-purple-800')}>
                  Detailed Examples with SQL & Configurations
                </h4>

                {/* Example 1: Sales & Inventory Valuation */}
                <div className={'p-4 rounded-xl border space-y-2.5 ' + (
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}>
                  <div className="flex items-center justify-between">
                    <span className={'text-xs font-bold ' + (isDark ? 'text-purple-300' : 'text-purple-900')}>
                      Example 1: Executive Sales & Inventory Valuation Report
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 font-mono">Retail / E-Commerce</span>
                  </div>
                  <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Summarizes inventory valuation, product quantities, and average prices across product categories:
                  </p>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                    <pre>{sampleReportSql1}</pre>
                  </div>
                  <div className={'text-xs space-y-1 pt-1 ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                    <div>• <strong>KPI Cards</strong>: Card 1 (<code className="font-mono text-indigo-600 dark:text-indigo-300">gross_inventory_value</code>, Currency format), Card 2 (<code className="font-mono text-indigo-600 dark:text-indigo-300">product_count</code>, Number format), Card 3 (<code className="font-mono text-indigo-600 dark:text-indigo-300">avg_unit_price</code>, Currency format).</div>
                    <div>• <strong>Chart</strong>: Bar Chart with Label: <code className="font-mono text-indigo-600 dark:text-indigo-300">category_name</code>, Value: <code className="font-mono text-indigo-600 dark:text-indigo-300">gross_inventory_value</code>, Color: <code className="font-mono text-indigo-600 dark:text-indigo-300">#4f46e5</code>.</div>
                    <div>• <strong>Table</strong>: Renders all columns with total stock counts and monetary values right-aligned.</div>
                  </div>
                </div>

                {/* Example 2: Customer CRM & Order Activity */}
                <div className={'p-4 rounded-xl border space-y-2.5 ' + (
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}>
                  <div className="flex items-center justify-between">
                    <span className={'text-xs font-bold ' + (isDark ? 'text-purple-300' : 'text-purple-900')}>
                      Example 2: Customer CRM & Account Activity Audit
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 font-mono">B2B & Accounts</span>
                  </div>
                  <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Aggregates lifetime order volume, total revenue spent, and recency of purchase per client:
                  </p>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                    <pre>{sampleReportSql2}</pre>
                  </div>
                  <div className={'text-xs space-y-1 pt-1 ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                    <div>• <strong>KPI Cards</strong>: Total Customer Revenue (<code className="font-mono text-indigo-600 dark:text-indigo-300">lifetime_value</code>), Average Deal Size (<code className="font-mono text-indigo-600 dark:text-indigo-300">avg_order_value</code>).</div>
                    <div>• <strong>Chart</strong>: Bar Chart displaying Top 10 clients by Lifetime Value with accent color <code className="font-mono text-indigo-600 dark:text-indigo-300">#0ea5e9</code> (Sky Blue).</div>
                  </div>
                </div>

                {/* Example 3: System Administration & Plugins Audit */}
                <div className={'p-4 rounded-xl border space-y-2.5 ' + (
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                )}>
                  <div className="flex items-center justify-between">
                    <span className={'text-xs font-bold ' + (isDark ? 'text-purple-300' : 'text-purple-900')}>
                      Example 3: Dynamic Plugins & Architecture Manifest Report
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 font-mono">System Governance</span>
                  </div>
                  <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>
                    Audits all custom TSX plugins stored and executed inside the database schema:
                  </p>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                    <pre>{sampleReportSql3}</pre>
                  </div>
                  <div className={'text-xs space-y-1 pt-1 ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                    <div>• Seeded by default in Gawkyy as <code className="font-mono text-indigo-600 dark:text-indigo-300">report_plugins_catalog</code> to document extensions and system modules.</div>
                  </div>
                </div>
              </div>

              {/* Best Practices & PDF Tips */}
              <div className={'p-4 rounded-xl border space-y-2 ' + (
                isDark ? 'bg-purple-950/20 border-purple-800/40 text-purple-200' : 'bg-purple-50/70 border-purple-200 text-purple-950'
              )}>
                <h5 className="text-xs font-bold flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-purple-500" />
                  <span>Executive Reporting & PDF Printing Pro-Tips</span>
                </h5>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  <li><strong className={isDark ? 'text-white' : 'text-purple-950'}>Enable Background Graphics</strong>: In the browser print dialog (Ctrl + P / Cmd + P), check the box for <em>"Background graphics"</em> to ensure KPI card shading and chart colors are captured in your exported PDF.</li>
                  <li><strong className={isDark ? 'text-white' : 'text-purple-950'}>Column Aliasing</strong>: Always assign clean SQL aliases (<code className="font-mono">AS revenue</code>, <code className="font-mono">AS order_count</code>) to avoid raw function names appearing in headers.</li>
                  <li><strong className={isDark ? 'text-white' : 'text-purple-950'}>Rounding & Formats</strong>: Wrap aggregate numbers in SQLite's <code className="font-mono">ROUND(..., 2)</code> function so currency metrics format cleanly to two decimal places.</li>
                  <li><strong className={isDark ? 'text-white' : 'text-purple-950'}>Paper Layout</strong>: The report canvas is styled to scale naturally to standard Letter and A4 portrait pages with zero clipping.</li>
                </ul>
              </div>
            </div>

            {/* Feature 3: Spreadsheet Studio */}
            <div className={'p-5 rounded-2xl border space-y-3 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
            )}>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>3. Spreadsheet Studio (Excel-Compatible Grid)</h3>
              </div>
              <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                A built-in reactive multi-sheet calculation engine for exploratory modeling and data analysis:
              </p>
              <ul className={'list-disc pl-5 space-y-1.5 text-xs ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Formulas & Calculation Engine</strong>: Standard spreadsheet formulas including <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-emerald-300 bg-slate-900' : 'text-emerald-800 bg-slate-100 border border-slate-200')}>=SUM(A1:A10)</code>, <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-emerald-300 bg-slate-900' : 'text-emerald-800 bg-slate-100 border border-slate-200')}>=AVERAGE(B1:B10)</code>, <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-emerald-300 bg-slate-900' : 'text-emerald-800 bg-slate-100 border border-slate-200')}>=COUNT(C1:C10)</code>, <code className={'font-mono px-1 py-0.5 rounded text-[11px] ' + (isDark ? 'text-emerald-300 bg-slate-900' : 'text-emerald-800 bg-slate-100 border border-slate-200')}>=IF(A1&gt;100, "High", "Low")</code>, and arbitrary arithmetic expressions.</li>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Multi-Sheet Workbooks</strong>: Add, rename, switch, and delete sheet tabs within a single session.</li>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>SQL Interoperability</strong>: Push query results from any SQL view directly into a fresh spreadsheet sheet with one click.</li>
                <li><strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>CSV Export</strong>: Download active sheets as clean CSV files for external analysis or sharing.</li>
              </ul>
            </div>

            {/* Feature 4: File Storage & 4-Way Auto-Sync Conflict Reconciliation */}
            <div className={'p-5 rounded-2xl border space-y-3 ' + (
              isDark ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'
            )}>
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                <Workflow className="w-5 h-5" />
                <h3 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>4. File Storage & 4-Way Auto-Sync Reconciliation</h3>
              </div>
              <p className={'text-xs leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>
                Gawkyy supports independent local disk file synchronization (via PWA File System Access API without persistent write locks) and Dropbox cloud synchronization.
                When auto-sync is enabled, Gawkyy executes a state-metric check across 4 conditions:
              </p>
              <div className="space-y-2 text-xs pt-1">
                <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>Condition 1 (Neither changed):</strong>
                  <span className={'ml-1 ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>No action required; database remains cleanly synchronized with disk and cloud.</span>
                </div>
                <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <strong className={isDark ? 'text-emerald-300' : 'text-emerald-800 font-bold'}>Condition 2 (Internal changed, external unchanged):</strong>
                  <span className={'ml-1 ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>Current database is saved directly to the external destination (disk or cloud), updating sync metrics.</span>
                </div>
                <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <strong className={isDark ? 'text-sky-300' : 'text-sky-800 font-bold'}>Condition 3 (External changed, internal unchanged):</strong>
                  <span className={'ml-1 ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>Internal database reloads the external changes automatically to stay continuously up to date.</span>
                </div>
                <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200')}>
                  <strong className={isDark ? 'text-amber-300' : 'text-amber-800 font-bold'}>Condition 4 (Both changed concurrently):</strong>
                  <span className={'ml-1 ' + (isDark ? 'text-slate-400' : 'text-slate-700')}>Gawkyy runs an automated reconciliation algorithm to merge non-overlapping schema and record additions. If an unresolvable collision occurs, a conflict dialog prompts you to keep internal, reload external, or save as a separate copy.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

export const DEFAULT_PLUGIN_MANAGER_CODE = `import React, { useState, useEffect, useMemo } from 'react';
import {
  Puzzle,
  Plus,
  Power,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Sparkles,
  Folder,
  Upload,
  Play,
  RefreshCw,
  Eye,
  Shield,
  Tag,
  AlertTriangle,
  User
} from 'lucide-react';

export default function PluginManagerPlugin({ gaw }) {
  const [plugins, setPlugins] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'SYSTEM' | 'USER'
  const [deleteModalPlugin, setDeleteModalPlugin] = useState(null);

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

  const loadPlugins = () => {
    try {
      const all = gaw.plugins.getAll();
      setPlugins(all);
    } catch (e) {
      gaw.toast.error('Failed to load plugins: ' + (e.message || String(e)));
    }
  };

  useEffect(() => {
    loadPlugins();
    const unsub = gaw.eventBus.on('db_changed', loadPlugins);
    return unsub;
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    plugins.forEach((p) => {
      if (p.menu_category) set.add(p.menu_category);
    });
    return Array.from(set).sort();
  }, [plugins]);

  const isSysPlugin = (p) => {
    return (
      p.id === 'plugin_dropbox_sync' ||
      p.id === 'plugin_local_storage' ||
      p.id === 'plugin_manager' ||
      p.id === 'plugin_file_manager' ||
      p.id === 'plugin_database_management' ||
      p.id === 'plugin_help' ||
      Boolean(p.is_system) ||
      Boolean(p.isSystem) ||
      (Boolean(p.menu_category) && p.menu_category.startsWith('System'))
    );
  };

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => {
      const matchSearch =
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.menu_category || '').toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'ALL' || p.menu_category === categoryFilter;
      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? p.enabled !== 0
          : p.enabled === 0;
      const isSys = isSysPlugin(p);
      const matchType = typeFilter === 'ALL' ? true : typeFilter === 'SYSTEM' ? isSys : !isSys;
      return matchSearch && matchCategory && matchStatus && matchType;
    });
  }, [plugins, search, categoryFilter, statusFilter, typeFilter]);

  const activeCount = plugins.filter((p) => p.enabled !== 0).length;
  const inactiveCount = plugins.filter((p) => p.enabled === 0).length;

  const handleToggleActive = (plugin) => {
    if (plugin.id === 'plugin_manager' || plugin.id === 'plugin_local_storage' || plugin.id === 'plugin_file_manager' || plugin.id === 'plugin_database_management') {
      gaw.toast.warning('Core system plugin "' + plugin.name + '" must remain active to keep the application operational.');
      return;
    }
    const nextState = plugin.enabled === 0 ? true : false;
    gaw.plugins.toggleEnabled(plugin.id, nextState);
    loadPlugins();
    gaw.toast.success(
      'Plugin "' + plugin.name + '" is now ' + (nextState ? 'Active (visible in sidebar)' : 'Inactive (hidden from sidebar)')
    );
  };

  const handleConfirmDelete = () => {
    if (!deleteModalPlugin) return;
    if (deleteModalPlugin.id === 'plugin_manager' || deleteModalPlugin.id === 'plugin_local_storage' || deleteModalPlugin.id === 'plugin_file_manager' || deleteModalPlugin.id === 'plugin_database_management') {
      gaw.toast.warning('Core system plugins cannot be removed.');
      setDeleteModalPlugin(null);
      return;
    }
    const name = deleteModalPlugin.name;
    gaw.plugins.delete(deleteModalPlugin.id);
    setDeleteModalPlugin(null);
    loadPlugins();
    gaw.toast.success('Removed plugin "' + name + '" from application database.');
  };

  const handleDirectImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result || '';
        const baseName = file.name
          .replace(/\.(tsx|ts|jsx|js|json)$/i, '')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());
        const id = 'plugin_' + file.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        gaw.plugins.importPlugin({
          id,
          name: baseName,
          version: '1.0.0',
          enabled: 1, // Active by default
          icon: 'Puzzle',
          menu_category: 'Custom',
          route: '/' + id,
          description: 'Imported from local file ' + file.name,
          code: text,
        });
        loadPlugins();
        gaw.toast.success('Imported "' + baseName + '" successfully (Active by default)');
      } catch (err) {
        gaw.toast.error('Import failed: ' + (err.message || String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateBlankPlugin = () => {
    const randomId = Math.floor(100 + Math.random() * 900);
    const id = 'plugin_custom_' + randomId;
    const name = 'New Custom Plugin ' + randomId;
    const blankCode = [
      "import React, { useState } from 'react';",
      "import { Sparkles, Database } from 'lucide-react';",
      "",
      "export default function CustomPlugin({ gaw }) {",
      "  const [tables] = useState(() => gaw.db.getTables());",
      "",
      "  return (",
      '    <div className="p-6 max-w-4xl mx-auto space-y-6 text-slate-100">',
      '      <div className="p-5 bg-slate-950/80 border border-indigo-700/50 rounded-2xl shadow-xl">',
      '        <h1 className="text-xl font-bold text-white flex items-center gap-2">',
      '          <Sparkles className="w-5 h-5 text-indigo-400" />',
      '          <span>' + name + '</span>',
      '        </h1>',
      '        <p className="text-xs text-slate-300 mt-1">',
      '          Edit this TSX component in the internal Monaco IDE. It has full access to SQLite via gaw.db.',
      '        </p>',
      '      </div>',
      '',
      '      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">',
      '        <h3 className="font-semibold text-slate-200">Database Tables ({tables.length}):</h3>',
      '        <div className="flex flex-wrap gap-2">',
      '          {tables.map((t) => (',
      '            <span key={t} className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-indigo-300 font-mono">',
      '              {t}',
      '            </span>',
      '          ))}',
      '        </div>',
      '      </div>',
      '    </div>',
      '  );',
      '}'
    ].join(String.fromCharCode(10));

    gaw.plugins.importPlugin({
      id,
      name,
      version: '1.0.0',
      enabled: 1, // Active by default
      icon: 'Puzzle',
      menu_category: 'Custom',
      route: '/' + id,
      description: 'Custom React TSX plugin component',
      code: blankCode,
    });
    loadPlugins();
    gaw.toast.success('Created "' + name + '"! Opening in IDE...');
    gaw.plugins.openInIDE(id, name);
  };

  return (
    <div className={'p-6 max-w-6xl mx-auto space-y-6 pb-28 ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
      {/* Header Banner */}
      <div className={'flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl shadow-xl backdrop-blur border ' + (
        isDark
          ? 'bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border-purple-800/50'
          : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
      )}>
        <div className="flex items-center gap-3.5">
          <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
            isDark ? 'bg-purple-600/30 border border-purple-500/40 text-purple-400' : 'bg-purple-100 border border-purple-300 text-purple-600'
          )}>
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <h1 className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Dynamic Plugin Registry & Manager</h1>
            <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-300' : 'text-slate-600')}>
              Manage runtime TSX plugins, toggle active/inactive visibility, import from disk or Dropbox, and edit code.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import Plugin File...</span>
            <input
              type="file"
              accept=".tsx,.ts,.jsx,.js,.json"
              className="hidden"
              onChange={handleDirectImportFile}
            />
          </label>
          <button
            onClick={handleCreateBlankPlugin}
            className={'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold shadow transition active:scale-95 ' + (
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            )}
            title="Create a new blank plugin and edit in IDE"
          >
            <Plus className="w-4 h-4 text-emerald-500" />
            <span>New Blank Plugin</span>
          </button>
          <button
            onClick={() => gaw.plugins.openAddModal()}
            className={'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold shadow transition active:scale-95 ' + (
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            )}
            title="Open Guided Import Wizard"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Import Wizard...</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className={'p-3.5 rounded-xl space-y-1 border ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          <span className={'text-[11px] font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Total Plugins</span>
          <p className={'text-xl font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>{plugins.length}</p>
        </div>
        <div className={'p-3.5 rounded-xl space-y-1 border ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          <span className="text-[11px] text-emerald-500 font-medium">Active Plugins</span>
          <p className="text-xl font-bold text-emerald-500">{activeCount}</p>
        </div>
        <div className={'p-3.5 rounded-xl space-y-1 border ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          <span className={'text-[11px] font-medium ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Inactive (Hidden)</span>
          <p className={'text-xl font-bold ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>{inactiveCount}</p>
        </div>
        <div className={'p-3.5 rounded-xl space-y-1 border ' + (isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm')}>
          <span className="text-[11px] text-purple-500 font-medium">Categories</span>
          <p className="text-xl font-bold text-purple-500">{categories.length}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className={'flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl text-xs border ' + (
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      )}>
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
          <div className="relative w-full">
            <Search className={'w-3.5 h-3.5 absolute left-3 top-2.5 ' + (isDark ? 'text-slate-500' : 'text-slate-400')} />
            <input
              type="text"
              placeholder="Search plugins by name, category, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={'w-full pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-indigo-500 border ' + (
                isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
              )}
            />
          </div>

          {/* Two toggle icons under search plugins */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTypeFilter((prev) => (prev === 'SYSTEM' ? 'ALL' : 'SYSTEM'))}
              title={typeFilter === 'SYSTEM' ? 'Showing System Plugins only (Click to show all)' : 'Show System Plugins only'}
              className={'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition active:scale-95 cursor-pointer ' + (
                typeFilter === 'SYSTEM'
                  ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                  : isDark
                  ? 'bg-slate-900 border-slate-700 text-purple-400 hover:text-purple-300 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-purple-700 hover:bg-purple-50'
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>System Plugins</span>
            </button>

            <button
              onClick={() => setTypeFilter((prev) => (prev === 'USER' ? 'ALL' : 'USER'))}
              title={typeFilter === 'USER' ? 'Showing User Plugins only (Click to show all)' : 'Show User Plugins only'}
              className={'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition active:scale-95 cursor-pointer ' + (
                typeFilter === 'USER'
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                  : isDark
                  ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800'
                  : 'bg-white border-slate-300 text-emerald-700 hover:bg-emerald-50'
              )}
            >
              <User className="w-3.5 h-3.5" />
              <span>User Plugins</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className={'flex items-center rounded-lg p-0.5 border ' + (
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
          )}>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={'px-2.5 py-1 rounded-md text-[11px] font-medium transition ' + (
                statusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={'px-2.5 py-1 rounded-md text-[11px] font-medium transition ' + (
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={'px-2.5 py-1 rounded-md text-[11px] font-medium transition ' + (
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Inactive ({inactiveCount})
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={'px-2.5 py-1.5 rounded-lg text-xs focus:outline-none border ' + (
              isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
            )}
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPlugins.map((p) => {
          const isActive = p.enabled !== 0;
          const isSystem = isSysPlugin(p);
          const isProtected = p.id === 'plugin_manager' || p.id === 'plugin_local_storage' || p.id === 'plugin_file_manager' || p.id === 'plugin_database_management';
          return (
            <div
              key={p.id}
              className={'p-5 rounded-xl border transition-all flex flex-col justify-between ' + (
                isActive
                  ? isDark
                    ? isSystem
                      ? 'bg-slate-950/80 border-purple-800/60 shadow-md hover:border-purple-500'
                      : 'bg-slate-950/80 border-emerald-800/60 shadow-md hover:border-emerald-500'
                    : isSystem
                    ? 'bg-white border-purple-300 shadow-sm hover:border-purple-400'
                    : 'bg-white border-emerald-300 shadow-sm hover:border-emerald-400'
                  : isDark
                  ? 'bg-slate-950/40 border-slate-800/40 opacity-70'
                  : 'bg-slate-50 border-slate-200 opacity-70'
              )}
            >
              <div className="space-y-3">
                {/* Header: Title, System/User Badge, Category, Toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={'font-bold text-sm ' + (isDark ? 'text-white' : 'text-slate-900')}>{p.name}</h3>
                      <span className={'text-[10px] font-mono px-1.5 py-0.2 rounded border ' + (
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                      )}>
                        v{p.version || '1.0.0'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ' + (
                        isSystem
                          ? isDark ? 'bg-purple-950/80 border-purple-700/60 text-purple-300' : 'bg-purple-50 border-purple-300 text-purple-700'
                          : isDark ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      )}>
                        {isSystem ? <Shield className="w-2.5 h-2.5 text-purple-400" /> : <User className="w-2.5 h-2.5 text-emerald-400" />}
                        <span>{isSystem ? 'System Plugin' : 'User Plugin'}</span>
                      </span>
                      <span className={'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ' + (
                        isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                      )}>
                        {p.menu_category || 'Custom'}
                      </span>
                    </div>
                  </div>

                  {/* Active / Inactive Switch */}
                  <button
                    onClick={() => handleToggleActive(p)}
                    disabled={isProtected}
                    className={'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition ' + (
                      isProtected
                        ? isDark ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-400 cursor-not-allowed opacity-90' : 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-not-allowed'
                        : isActive
                        ? isDark ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 active:scale-95' : 'bg-emerald-100 border-emerald-400 text-emerald-800 active:scale-95'
                        : isDark ? 'bg-slate-900 border-slate-700 text-slate-400 active:scale-95' : 'bg-slate-200 border-slate-300 text-slate-600 active:scale-95'
                    )}
                    title={isProtected ? 'Core system plugin must remain active' : isActive ? 'Click to make Inactive (hide from sidebar)' : 'Click to make Active (show in sidebar)'}
                  >
                    <Power className="w-3 h-3" />
                    <span>{isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                </div>

                {/* Description */}
                <p className={'text-xs line-clamp-2 leading-relaxed ' + (isDark ? 'text-slate-300' : 'text-slate-600')}>
                  {p.description || 'Dynamic client-compiled TSX plugin component.'}
                </p>

                {/* Route & Metadata */}
                <div className={'flex items-center gap-2 text-[10px] font-mono ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>
                  <span>ID: {p.id}</span>
                  <span>•</span>
                  <span>Route: {p.route || '/' + p.id}</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className={'pt-4 mt-3 border-t flex items-center justify-between gap-2 ' + (isDark ? 'border-slate-800/80' : 'border-slate-100')}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => gaw.navigation.openPlugin(p.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Open</span>
                  </button>
                  <button
                    onClick={() => gaw.plugins.openInIDE(p.id, p.name)}
                    className={'flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 ' + (
                      isDark ? 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-slate-700 hover:border-indigo-500/50' : 'bg-slate-50 hover:bg-slate-100 text-indigo-700 border-slate-300 hover:border-indigo-400'
                    )}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit in IDE</span>
                  </button>
                </div>

                {isProtected ? (
                  <span
                    className={'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-semibold select-text ' + (
                      isDark ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    )}
                    title="Core System Plugin - Cannot be deleted to ensure application remains operational"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Protected</span>
                  </span>
                ) : (
                  <button
                    onClick={() => setDeleteModalPlugin(p)}
                    className={'p-1.5 rounded-lg transition ' + (
                      isDark ? 'hover:bg-red-950/60 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-600'
                    )}
                    title="Delete plugin from app database"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className={'w-full max-w-md border rounded-2xl shadow-2xl p-6 space-y-4 ' + (
            isDark ? 'bg-slate-900 border-red-800/80 text-slate-100' : 'bg-white border-red-200 text-slate-900'
          )}>
            <div className="flex items-center gap-3 text-red-500">
              <div className={'w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ' + (
                isDark ? 'bg-red-950/80 border-red-800/80' : 'bg-red-50 border-red-200'
              )}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Delete Plugin from App?</h3>
                <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>{deleteModalPlugin.name}</p>
              </div>
            </div>

            <div className={'p-3.5 border rounded-xl text-xs space-y-2 ' + (
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            )}>
              <p className="font-semibold text-amber-500">Safe Deletion Guarantee:</p>
              <p className="leading-relaxed">
                Only the plugin record inside this application's SQLite database (<code className={'font-mono ' + (isDark ? 'text-slate-100' : 'text-slate-900')}>t_plugins</code>) will be removed.
              </p>
              <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                Your original source file on local disk or Dropbox will <strong>NOT</strong> be deleted or touched.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalPlugin(null)}
                className={'px-4 py-2 rounded-lg text-xs font-semibold transition ' + (
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition active:scale-95"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

export const DEFAULT_FILE_MANAGER_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  HardDrive,
  Cloud,
  Sparkles,
  Clock,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  Shield,
  FileCode,
  Save,
  Check,
  Folder,
  Download,
  FileSpreadsheet
} from 'lucide-react';

export default function FileManagerPlugin({ gaw }) {
  const [storageMeta, setStorageMeta] = useState(() => gaw.storage.getMetadata());
  const [dropboxConfig, setDropboxConfig] = useState(() => gaw.dropbox.getConfig());
  const [recentFiles, setRecentFiles] = useState(() => gaw.workspace.getRecentFiles());
  const [sidebarOpen, setSidebarOpen] = useState(() => gaw.workspace.isSidebarOpen());
  const [isConnectingDropbox, setIsConnectingDropbox] = useState(false);
  const [showDropboxPicker, setShowDropboxPicker] = useState(false);
  const [dropboxFiles, setDropboxFiles] = useState([]);
  const [isLoadingDropbox, setIsLoadingDropbox] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gaw_theme');
      if (stored === 'vs-light' || stored === 'vs-dark') return stored;
    }
    return gaw.theme || 'vs-dark';
  });

  useEffect(() => {
    const unsub = gaw.eventBus?.on('theme_changed', (th) => {
      if (th === 'vs-light' || th === 'vs-dark') setCurrentTheme(th);
    });
    return () => { if (unsub) unsub(); };
  }, [gaw.eventBus]);

  const isDark = currentTheme === 'vs-dark';

  useEffect(() => {
    const unsubStorage = gaw.storage.onStatusChange((meta) => {
      setStorageMeta(meta);
    });
    const unsubDropbox = gaw.dropbox.subscribe((cfg) => {
      setDropboxConfig(cfg);
    });
    const unsubRecent = gaw.eventBus.on('recent_files_changed', () => {
      setRecentFiles(gaw.workspace.getRecentFiles());
    });

    if (gaw.dropbox.getConfig().accessToken && !gaw.dropbox.getConfig().connected) {
      setIsConnectingDropbox(true);
      gaw.dropbox.validateToken().then((ok) => {
        setIsConnectingDropbox(false);
        setDropboxConfig(gaw.dropbox.getConfig());
        if (ok) {
          gaw.toast.info('Dropbox connection restored.');
        }
      }).catch(() => {
        setIsConnectingDropbox(false);
      });
    }

    return () => {
      unsubStorage();
      unsubDropbox();
      unsubRecent();
    };
  }, [gaw]);

  const handleOpenLocal = async () => {
    try {
      const ok = await gaw.storage.openFile();
      if (ok) {
        gaw.workspace?.setSidebarOpen(true);
        setSidebarOpen(true);
        setRecentFiles(gaw.workspace.getRecentFiles());
        gaw.toast.success('Local database opened successfully.');
      }
    } catch (err) {
      gaw.toast.error('Failed to open local file: ' + (err.message || 'Unknown error'));
    }
  };

  const handleOpenDropboxBrowser = async () => {
    if (!dropboxConfig.connected) {
      gaw.navigation.openPlugin('plugin_dropbox_sync');
      return;
    }
    setShowDropboxPicker(true);
    setIsLoadingDropbox(true);
    try {
      const files = await gaw.dropbox.listDatabaseFiles();
      setDropboxFiles(files || []);
    } catch (err) {
      gaw.toast.error('Failed to list Dropbox files: ' + (err.message || ''));
    } finally {
      setIsLoadingDropbox(false);
    }
  };

  const handleSelectDropboxFile = async (fileItem) => {
    try {
      setShowDropboxPicker(false);
      const ok = await gaw.dropbox.downloadFile(fileItem);
      if (ok) {
        gaw.workspace?.setSidebarOpen(true);
        setSidebarOpen(true);
        setRecentFiles(gaw.workspace.getRecentFiles());
        gaw.toast.success('Loaded ' + fileItem.name + ' from Dropbox.');
      }
    } catch (err) {
      gaw.toast.error('Failed to download file: ' + (err.message || ''));
    }
  };

  const handleOpenNorthwindDemo = () => {
    gaw.workspace.loadNorthwindDemo();
    gaw.workspace?.setSidebarOpen(true);
    setSidebarOpen(true);
  };

  const handleCloseActiveDatabase = async () => {
    if (storageMeta.syncStatus === 'dirty') {
      const confirm = await gaw.dialog.confirm(
        'You have unsaved changes in the active database. Closing will discard unsaved modifications. Do you want to close?'
      );
      if (!confirm) return;
    }
    await gaw.workspace.closeDatabase();
    setStorageMeta(gaw.storage.getMetadata());
  };

  const handleClearRecentFiles = () => {
    gaw.workspace.clearRecentFiles();
    setRecentFiles([]);
    setShowClearConfirm(false);
    gaw.toast.success('Recent files log cleared. (Disk and cloud files remain unchanged)');
  };

  const handleRemoveRecentFile = (id, e) => {
    e.stopPropagation();
    gaw.workspace.removeRecentFile(id);
    setRecentFiles(gaw.workspace.getRecentFiles());
    gaw.toast.info('Removed entry from recent files log.');
  };

  const handleOpenRecent = async (file) => {
    if (file.source === 'demo') {
      handleOpenNorthwindDemo();
    } else if (file.source === 'dropbox') {
      if (!dropboxConfig.connected) {
        gaw.toast.warning('Dropbox is not connected. Opening Dropbox Sync plugin...');
        gaw.navigation.openPlugin('plugin_dropbox_sync');
        return;
      }
      try {
        const ok = await gaw.dropbox.downloadFile({
          name: file.name,
          path_display: file.path || '/' + file.name,
        });
        if (ok) {
          gaw.workspace?.setSidebarOpen(true);
          setSidebarOpen(true);
          setRecentFiles(gaw.workspace.getRecentFiles());
          gaw.toast.success('Loaded ' + file.name + ' from Dropbox.');
        }
      } catch (err) {
        gaw.toast.error('Could not open Dropbox file: ' + (err.message || 'File not found'));
      }
    } else {
      await handleOpenLocal();
    }
  };

  const handleToggleSidebar = () => {
    gaw.workspace.toggleSidebar();
    setSidebarOpen(!sidebarOpen);
  };

  function formatDate(iso) {
    if (!iso) return 'Unknown';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const now = Date.now();
      const diff = (now - d.getTime()) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <div className={'p-6 max-w-6xl mx-auto space-y-6 pb-28 ' + (isDark ? 'text-slate-100' : 'text-slate-800')}>
      {/* Top Header */}
      <div className={'flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b ' + (
        isDark ? 'border-slate-800' : 'border-slate-200'
      )}>
        <div>
          <div className='flex items-center gap-3'>
            <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + (
              isDark ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border border-indigo-200 text-indigo-600'
            )}>
              <FolderOpen className='w-5 h-5' />
            </div>
            <div>
              <h1 className={'text-xl font-bold tracking-tight flex items-center gap-2 ' + (
                isDark ? 'text-white' : 'text-slate-900'
              )}>
                File & Workspace Manager
              </h1>
              <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                Open local databases, sync with Dropbox, manage recent files, or explore the Northwind demo.
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className='flex items-center gap-2 flex-wrap'>
          {/* Dropbox Status Badge */}
          {dropboxConfig.connected ? (
            <div className={'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ' + (
              isDark ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border border-emerald-300 text-emerald-700'
            )}>
              <CheckCircle2 className='w-3.5 h-3.5 text-emerald-500' />
              <span>Dropbox Connected</span>
              {dropboxConfig.accountName && (
                <span className='opacity-80 font-mono text-[11px]'>
                  ({dropboxConfig.accountName})
                </span>
              )}
              <button
                onClick={() => gaw.navigation.openPlugin('plugin_dropbox_sync')}
                className={'ml-1 text-[11px] underline ' + (isDark ? 'text-emerald-400 hover:text-emerald-200' : 'text-emerald-700 hover:text-emerald-900')}
              >
                Sync Settings
              </button>
            </div>
          ) : (
            <div className={'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ' + (
              isDark ? 'bg-slate-800/80 border border-slate-700 text-slate-400' : 'bg-slate-100 border border-slate-300 text-slate-600'
            )}>
              <Cloud className='w-3.5 h-3.5 opacity-70' />
              <span>Dropbox Disconnected</span>
              <button
                onClick={() => gaw.navigation.openPlugin('plugin_dropbox_sync')}
                className={'ml-1 text-[11px] underline font-medium ' + (
                  isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'
                )}
              >
                Connect Cloud Sync
              </button>
            </div>
          )}

          {/* Storage Mode Badge */}
          <div className={'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ' + (
            isDark ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-100 border border-slate-300 text-slate-700'
          )}>
            <HardDrive className={'w-3.5 h-3.5 ' + (isDark ? 'text-indigo-400' : 'text-indigo-600')} />
            <span>Target: {storageMeta.activeTarget === 'dropbox' ? 'Dropbox' : 'Local Disk'}</span>
          </div>
        </div>
      </div>

      {/* Active Database Overview & File Closing Card */}
      <div className={'rounded-2xl p-5 shadow-lg space-y-4 border ' + (
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      )}>
        <div className={'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ' + (
          isDark ? 'border-slate-800/80' : 'border-slate-100'
        )}>
          <div className='flex items-center gap-3'>
            <div className={'w-8 h-8 rounded-lg flex items-center justify-center ' + (
              isDark ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-600'
            )}>
              <Database className='w-4 h-4' />
            </div>
            <div>
              <div className='flex items-center gap-2'>
                <span className={'text-xs font-semibold uppercase tracking-wider ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Active Loaded Database
                </span>
                <span className={'px-2 py-0.5 rounded text-[10px] font-semibold ' + (
                  storageMeta.syncStatus === 'dirty'
                    ? isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-300'
                    : isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                )}>
                  {storageMeta.syncStatus === 'dirty' ? 'Modified (Unsaved)' : 'Synchronized'}
                </span>
              </div>
              <h2 className={'text-base font-bold font-mono mt-0.5 ' + (isDark ? 'text-white' : 'text-slate-900')}>
                {storageMeta.fileName || 'northwind_commerce.db'}
              </h2>
            </div>
          </div>

          <div className='flex items-center gap-2 flex-wrap'>
            <button
              onClick={() => gaw.storage.save()}
              className='px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow transition'
            >
              <Save className='w-3.5 h-3.5' />
              <span>Save Database</span>
            </button>
            <button
              onClick={() => gaw.storage.saveAs()}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition ' + (
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm'
              )}
            >
              Save As...
            </button>
            <button
              onClick={() => gaw.storage.exportDownload()}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition ' + (
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-sm'
              )}
              title='Export direct file download'
            >
              Export .db
            </button>
            <button
              onClick={handleCloseActiveDatabase}
              className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ' + (
                isDark ? 'bg-red-950/40 hover:bg-red-900/60 border-red-800/40 text-red-300' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
              )}
              title='Close active file and unload database'
            >
              <X className='w-3.5 h-3.5 text-red-500' />
              <span>Close Active Database</span>
            </button>
          </div>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs'>
          <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-950/60 border-slate-800/60' : 'bg-slate-50 border-slate-200')}>
            <span className={'block text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>File Size</span>
            <span className={'font-mono font-semibold mt-0.5 block ' + (isDark ? 'text-white' : 'text-slate-900')}>
              {formatBytes(storageMeta.fileSize)}
            </span>
          </div>
          <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-950/60 border-slate-800/60' : 'bg-slate-50 border-slate-200')}>
            <span className={'block text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Storage Target</span>
            <span className={'font-semibold mt-0.5 block capitalize ' + (isDark ? 'text-white' : 'text-slate-900')}>
              {storageMeta.activeTarget === 'dropbox' ? 'Dropbox Cloud' : storageMeta.hasFileHandle ? 'Local Disk Handle' : 'In-Memory DB'}
            </span>
          </div>
          <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-950/60 border-slate-800/60' : 'bg-slate-50 border-slate-200')}>
            <span className={'block text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Last Saved</span>
            <span className={'font-semibold mt-0.5 block ' + (isDark ? 'text-white' : 'text-slate-900')}>
              {storageMeta.lastSavedAt ? formatDate(storageMeta.lastSavedAt.toISOString()) : 'Not saved yet'}
            </span>
          </div>
          <div className={'p-3 rounded-xl border ' + (isDark ? 'bg-slate-950/60 border-slate-800/60' : 'bg-slate-50 border-slate-200')}>
            <span className={'block text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Database Tables</span>
            <span className={'font-semibold mt-0.5 block ' + (isDark ? 'text-white' : 'text-slate-900')}>
              {gaw.db.getTables().length + ' user tables'}
            </span>
          </div>
        </div>
      </div>

      {/* Main 3 File Opening Options */}
      <div>
        <h2 className={'text-xs font-semibold uppercase tracking-wider mb-3 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
          Open or Launch Database
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          {/* Card 1: Local File */}
          <div className={'rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group border ' + (
            isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          )}>
            <div className='space-y-3'>
              <div className={'w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition ' + (
                isDark ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400' : 'bg-blue-50 border border-blue-200 text-blue-600'
              )}>
                <HardDrive className='w-6 h-6' />
              </div>
              <div>
                <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Open Local File</h3>
                <p className={'text-xs mt-1 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Open any SQLite database file (.db, .sqlite, .sqlite3) stored directly on your computer's local hard drive.
                </p>
              </div>
            </div>
            <div className='pt-5'>
              <button
                onClick={handleOpenLocal}
                className='w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2 active:scale-98'
              >
                <FolderOpen className='w-4 h-4' />
                <span>Choose Local File...</span>
              </button>
            </div>
          </div>

          {/* Card 2: Dropbox Cloud */}
          <div className={'rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group border ' + (
            isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          )}>
            <div className='space-y-3'>
              <div className={'w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition ' + (
                isDark ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border border-indigo-200 text-indigo-600'
              )}>
                <Cloud className='w-6 h-6' />
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Open from Dropbox</h3>
                  {dropboxConfig.connected && (
                    <span className={'px-1.5 py-0.5 rounded text-[10px] font-semibold ' + (
                      isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    )}>
                      Connected
                    </span>
                  )}
                </div>
                <p className={'text-xs mt-1 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                  {dropboxConfig.connected
                    ? 'Browse database files in your connected Dropbox storage and open them directly into Gawkyy.'
                    : 'Connect your Dropbox account to browse, pull, and synchronize cloud databases anywhere.'}
                </p>
              </div>
            </div>
            <div className='pt-5 space-y-2'>
              {dropboxConfig.connected ? (
                <button
                  onClick={handleOpenDropboxBrowser}
                  className='w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2 active:scale-98'
                >
                  <Cloud className='w-4 h-4' />
                  <span>Browse Dropbox Files...</span>
                </button>
              ) : (
                <button
                  onClick={() => gaw.navigation.openPlugin('plugin_dropbox_sync')}
                  className={'w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 active:scale-98 border ' + (
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-700/40' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                  )}
                >
                  <ExternalLink className='w-4 h-4' />
                  <span>Open Dropbox Cloud Sync</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Northwind Demo */}
          <div className={'rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group border ' + (
            isDark
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border-indigo-900/40 hover:border-indigo-600/50'
              : 'bg-gradient-to-br from-white via-white to-indigo-50/50 border-indigo-200 hover:border-indigo-300 shadow-sm'
          )}>
            <div className='space-y-3'>
              <div className={'w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-105 transition ' + (
                isDark ? 'bg-purple-600/20 border border-purple-500/30 text-purple-400' : 'bg-purple-50 border border-purple-200 text-purple-600'
              )}>
                <Sparkles className='w-6 h-6' />
              </div>
              <div>
                <div className='flex items-center gap-2'>
                  <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Open Northwind Demo</h3>
                  <span className={'px-1.5 py-0.5 rounded text-[10px] font-semibold ' + (
                    isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-800 border border-purple-300'
                  )}>
                    Demo Template
                  </span>
                </div>
                <p className={'text-xs mt-1 leading-relaxed ' + (isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Open the full Northwind Modern Commerce sample suite with orders, inventory, CRM, and interactive reports.
                </p>
              </div>
            </div>
            <div className='pt-5'>
              <button
                onClick={handleOpenNorthwindDemo}
                className='w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2 active:scale-98'
              >
                <Sparkles className='w-4 h-4' />
                <span>Open Northwind Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Files Log Section */}
      <div className={'rounded-2xl p-5 shadow-lg space-y-4 border ' + (
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      )}>
        <div className={'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ' + (
          isDark ? 'border-slate-800' : 'border-slate-100'
        )}>
          <div>
            <div className='flex items-center gap-2'>
              <h2 className={'text-base font-bold flex items-center gap-2 ' + (isDark ? 'text-white' : 'text-slate-900')}>
                <Clock className='w-4 h-4 text-indigo-500' />
                <span>Recent Files Log</span>
              </h2>
              <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold border ' + (
                isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
              )}>
                {recentFiles.length + ' recorded'}
              </span>
            </div>
            <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
              Maintained in your browser's private local storage. Blank in new incognito browser windows.
            </p>
          </div>

          {recentFiles.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className={'px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 self-start sm:self-auto ' + (
                isDark ? 'bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-300 border-slate-700 hover:border-red-800/40' : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-300 hover:border-red-200'
              )}
              title='Delete recent files log from local browser storage'
            >
              <Trash2 className='w-3.5 h-3.5' />
              <span>Clear Recent Files Log</span>
            </button>
          )}
        </div>

        {recentFiles.length === 0 ? (
          <div className={'py-12 flex flex-col items-center justify-center text-center space-y-3 rounded-xl border border-dashed ' + (
            isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-300'
          )}>
            <div className={'w-12 h-12 rounded-2xl flex items-center justify-center ' + (
              isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-400'
            )}>
              <FolderOpen className='w-6 h-6' />
            </div>
            <div className='max-w-sm'>
              <h4 className={'text-sm font-semibold ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>No Recent Files Recorded</h4>
              <p className={'text-xs mt-1 leading-relaxed ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>
                Open a local file, pull a database from Dropbox, or launch the Northwind Demo above to track files here.
              </p>
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-xs'>
              <thead>
                <tr className={'border-b uppercase tracking-wider text-[10px] font-semibold ' + (
                  isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500 bg-slate-50/50'
                )}>
                  <th className='py-2.5 px-3'>Database File</th>
                  <th className='py-2.5 px-3'>Source</th>
                  <th className='py-2.5 px-3'>Size</th>
                  <th className='py-2.5 px-3'>Last Opened</th>
                  <th className='py-2.5 px-3 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className={'divide-y ' + (isDark ? 'divide-slate-800/60' : 'divide-slate-200')}>
                {recentFiles.map((file) => {
                  const isDemo = file.source === 'demo';
                  const isDropbox = file.source === 'dropbox';
                  return (
                    <tr
                      key={file.id}
                      className={'transition group cursor-pointer ' + (isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50')}
                      onClick={() => handleOpenRecent(file)}
                    >
                      <td className='py-3 px-3'>
                        <div className='flex items-center gap-2.5'>
                          <div className={'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ' + (
                            isDemo
                              ? isDark ? 'bg-purple-600/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                              : isDropbox
                              ? isDark ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                              : isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                          )}>
                            {isDemo ? (
                              <Sparkles className='w-3.5 h-3.5' />
                            ) : isDropbox ? (
                              <Cloud className='w-3.5 h-3.5' />
                            ) : (
                              <HardDrive className='w-3.5 h-3.5' />
                            )}
                          </div>
                          <div>
                            <span className={'font-semibold block transition ' + (
                              isDark ? 'text-white group-hover:text-indigo-300' : 'text-slate-900 group-hover:text-indigo-600'
                            )}>
                              {file.name}
                            </span>
                            <span className={'text-[10px] font-mono ' + (isDark ? 'text-slate-500' : 'text-slate-400')}>
                              {file.path || (isDropbox ? 'Dropbox Cloud' : 'Local Disk')}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className='py-3 px-3'>
                        <span className={'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ' + (
                          isDemo
                            ? isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-800 border border-purple-200'
                            : isDropbox
                            ? isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : isDark ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        )}>
                          {isDemo ? 'Demo Template' : isDropbox ? 'Dropbox' : 'Local Disk'}
                        </span>
                      </td>

                      <td className={'py-3 px-3 font-mono ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {file.size ? formatBytes(file.size) : '—'}
                      </td>

                      <td className={'py-3 px-3 whitespace-nowrap ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {formatDate(file.lastOpened)}
                      </td>

                      <td className='py-3 px-3 text-right'>
                        <div className='flex items-center justify-end gap-1.5'>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRecent(file);
                            }}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition shadow"
                          >
                            Open
                          </button>
                          <button
                            onClick={(e) => handleRemoveRecentFile(file.id, e)}
                            className={'p-1 rounded transition ' + (
                              isDark ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-slate-400 hover:text-red-600 hover:bg-slate-100'
                            )}
                            title='Remove from recent list'
                          >
                            <Trash2 className='w-3.5 h-3.5' />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Option Bar: Toggle Side Panel */}
      <div className={'rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ' + (
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      )}>
        <div className='flex items-center gap-3'>
          <div className={'w-9 h-9 rounded-xl border flex items-center justify-center ' + (
            isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
          )}>
            {sidebarOpen ? (
              <PanelLeftClose className='w-5 h-5 text-indigo-500' />
            ) : (
              <PanelLeftOpen className='w-5 h-5 text-slate-400' />
            )}
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <span className={'text-xs font-semibold ' + (isDark ? 'text-white' : 'text-slate-900')}>
                Workspace Side Navigation Pane
              </span>
              <span className={'px-1.5 py-0.2 rounded text-[10px] font-semibold ' + (
                sidebarOpen
                  ? isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                  : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 border border-slate-200 text-slate-600'
              )}>
                {sidebarOpen ? 'Visible' : 'Hidden'}
              </span>
            </div>
            <p className={'text-xs mt-0.5 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
              {sidebarOpen
                ? 'The side navigation panel is visible. You can browse tables, queries, reports, and plugins.'
                : 'The side navigation panel is hidden for a clean, focused initial view.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleSidebar}
          className='px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition flex items-center justify-center gap-2 active:scale-95 flex-shrink-0'
        >
          {sidebarOpen ? (
            <>
              <PanelLeftClose className='w-4 h-4' />
              <span>Hide Side Panel</span>
            </>
          ) : (
            <>
              <PanelLeftOpen className='w-4 h-4' />
              <span>Show Side Panel</span>
            </>
          )}
        </button>
      </div>

      {/* Confirmation Modal: Delete Recent Files Log */}
      {showClearConfirm && (
        <div className='fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'>
          <div className={'max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 border ' + (
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          )}>
            <div className='flex items-center gap-3'>
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center text-red-500 ' + (
                isDark ? 'bg-red-600/20 border border-red-500/30' : 'bg-red-50 border border-red-200'
              )}>
                <Trash2 className='w-5 h-5' />
              </div>
              <div>
                <h3 className={'text-base font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Clear Recent Files Log?</h3>
                <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>This action is safe and non-destructive.</p>
              </div>
            </div>

            <div className={'p-3.5 border rounded-xl text-xs space-y-2 ' + (
              isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            )}>
              <p className="font-semibold text-emerald-500">Non-Destructive Guarantee:</p>
              <p className='leading-relaxed'>
                Clearing the log removes only your session history from this browser's local storage.
              </p>
              <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                Your actual database files on local disk or Dropbox will <strong>NOT</strong> be deleted or modified.
              </p>
            </div>

            <div className='flex items-center justify-end gap-2 pt-2'>
              <button
                onClick={() => setShowClearConfirm(false)}
                className={'px-4 py-2 rounded-lg text-xs font-semibold transition ' + (
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleClearRecentFiles}
                className='px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow transition active:scale-95'
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropbox File Picker Modal */}
      {showDropboxPicker && (
        <div className='fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4'>
          <div className={'max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 border ' + (
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          )}>
            <div className={'flex items-center justify-between border-b pb-3 ' + (isDark ? 'border-slate-800' : 'border-slate-100')}>
              <div className='flex items-center gap-2.5'>
                <div className={'w-8 h-8 rounded-lg flex items-center justify-center ' + (
                  isDark ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                )}>
                  <Cloud className='w-4 h-4' />
                </div>
                <div>
                  <h3 className={'text-sm font-bold ' + (isDark ? 'text-white' : 'text-slate-900')}>Select Database from Dropbox</h3>
                  <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Showing .db and .sqlite files in your Dropbox</p>
                </div>
              </div>
              <button
                onClick={() => setShowDropboxPicker(false)}
                className={'p-1 rounded transition ' + (isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100')}
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {isLoadingDropbox ? (
              <div className={'py-8 flex flex-col items-center justify-center space-y-2 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                <RefreshCw className='w-5 h-5 animate-spin text-indigo-500' />
                <span className='text-xs'>Scanning Dropbox for databases...</span>
              </div>
            ) : dropboxFiles.length === 0 ? (
              <div className='py-8 text-center space-y-2'>
                <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>No database files (.db, .sqlite) found in Dropbox.</p>
                <button
                  onClick={() => {
                    setShowDropboxPicker(false);
                    gaw.navigation.openPlugin('plugin_dropbox_sync');
                  }}
                  className={'text-xs underline ' + (isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800')}
                >
                  Open Dropbox Cloud Sync to push the active database
                </button>
              </div>
            ) : (
              <div className={'max-h-64 overflow-y-auto divide-y ' + (isDark ? 'divide-slate-800/80' : 'divide-slate-100')}>
                {dropboxFiles.map((file) => (
                  <button
                    key={file.id || file.path_display}
                    onClick={() => handleSelectDropboxFile(file)}
                    className={'w-full text-left py-2.5 px-3 rounded-lg flex items-center justify-between group transition ' + (
                      isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className='flex items-center gap-2.5 min-w-0'>
                      <Database className='w-4 h-4 text-indigo-500 flex-shrink-0' />
                      <div className='truncate'>
                        <span className={'text-xs font-semibold block truncate group-hover:text-indigo-500 ' + (isDark ? 'text-white' : 'text-slate-900')}>
                          {file.name}
                        </span>
                        <span className={'text-[10px] block truncate font-mono ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                          {file.path_display}
                        </span>
                      </div>
                    </div>
                    <span className={'text-[11px] font-mono flex-shrink-0 ml-2 ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {formatBytes(file.size)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className={'flex items-center justify-end pt-2 border-t ' + (isDark ? 'border-slate-800' : 'border-slate-100')}>
              <button
                onClick={() => setShowDropboxPicker(false)}
                className={'px-4 py-2 rounded-lg text-xs font-semibold transition ' + (
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                )}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
