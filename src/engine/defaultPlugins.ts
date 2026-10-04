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
 * GAW (Generic Application Wrapper) - Hello World Plugin
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

export const DEFAULT_DROPBOX_PLUGIN_CODE = `import React, { useState, useEffect } from 'react';
import {
  Cloud,
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

  const handlePushNow = async () => {
    setIsPushing(true);
    try {
      const res = await gaw.dropbox.uploadActiveDatabase();
      gaw.toast.success('Pushed database to Dropbox (' + res.name + ')');
    } catch (err) {
      gaw.toast.error('Push failed: ' + (err.message || String(err)));
    } finally {
      setIsPushing(false);
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
      gaw.workspace?.setSidebarOpen(true);
      gaw.toast.success('Successfully pulled ' + remote.name + ' from Dropbox!');
    } catch (err) {
      gaw.toast.error('Pull failed: ' + (err.message || String(err)));
    } finally {
      setIsPulling(false);
    }
  };

  const handleLoadRemoteFile = async (file) => {
    const confirmed = await gaw.dialog.confirm(
      'Load ' + file.name + ' into Gawkyy? This will switch your active database.'
    );
    if (!confirmed) return;

    try {
      await gaw.dropbox.downloadFile(file);
      gaw.workspace?.setSidebarOpen(true);
      gaw.toast.success('Loaded ' + file.name + ' from Dropbox!');
    } catch (err) {
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

  const handleIntervalChange = (val) => {
    const num = parseInt(val, 10);
    setAutoInterval(num);
    gaw.dropbox.setAutoSyncInterval(num);
    gaw.toast.info('Dropbox auto-sync interval set to ' + (num === 0 ? 'Off' : num + ' seconds'));
  };

  const handleToggleAuto = (enabled) => {
    setAutoEnabled(enabled);
    gaw.dropbox.setAutoSyncEnabled(enabled);
    gaw.toast.info('Dropbox auto-sync ' + (enabled ? 'enabled' : 'disabled'));
  };

  const handleSetAsActiveTarget = () => {
    gaw.dropbox.setActiveTarget('dropbox');
    gaw.toast.success('Dropbox is now the primary active sync target!');
  };

  const isDropboxActive = storageMeta.activeTarget === 'dropbox';
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
              className="px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Target Coordination Status Banner */}
      <div className={'p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ' + (isDropboxActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-amber-500/10 border-amber-500/30 text-amber-600')}>
        <div className="flex items-center gap-2.5">
          {isDropboxActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <HardDrive className="w-4 h-4 text-amber-500" />}
          <div>
            <p className="font-bold">
              {isDropboxActive
                ? 'Dropbox is currently your Primary Active Sync Target'
                : 'Current syncing is with a Local Disk File, not Dropbox'}
            </p>
            <p className="text-[11px] opacity-80">
              {isDropboxActive
                ? 'Automatic background sync periodically flushes database mutations to Dropbox.'
                : 'Dropbox automatic background sync is paused so it will not overwrite your local disk edits.'}
            </p>
          </div>
        </div>
        {!isDropboxActive && (
          <button
            onClick={handleSetAsActiveTarget}
            className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow transition active:scale-95"
          >
            Set Dropbox as Primary Sync Target
          </button>
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
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Sync Status:</span>
                <span className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase ' + (
                  storageMeta.syncStatus === 'dirty'
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                )}>
                  {storageMeta.syncStatus === 'dirty' ? 'Unsynced Local Edits' : 'Clean / Synced'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handlePushNow}
                disabled={isPushing || !config.connected}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow transition active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>{isPushing ? 'Pushing...' : 'Push to Dropbox Now'}</span>
              </button>
              <button
                onClick={handlePullNow}
                disabled={isPulling || !config.connected}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs border border-slate-700 transition active:scale-95"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>{isPulling ? 'Pulling...' : 'Pull from Dropbox'}</span>
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
              When Dropbox is the primary active target, the background sync engine automatically pushes local changes to your cloud folder.
            </p>

            <div className="space-y-4 pt-2">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-white">Enable Cloud Auto-Sync</p>
                  <p className="text-[11px] text-slate-400">Periodically upload changes while you work</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => handleToggleAuto(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Sync Frequency Interval:</label>
                <select
                  value={autoInterval}
                  onChange={(e) => handleIntervalChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value={10}>Every 10 seconds (High frequency)</option>
                  <option value={30}>Every 30 seconds (Standard)</option>
                  <option value={60}>Every 60 seconds (Recommended)</option>
                  <option value={300}>Every 5 minutes</option>
                  <option value={900}>Every 15 minutes</option>
                  <option value={0}>Manual only (Off)</option>
                </select>
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-[11px] text-blue-300 flex items-start gap-2">
                <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Automatic sync applies seamless overwrite to <code className="text-white font-mono">/{storageMeta.fileName}</code>.
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

  const handleSaveNow = async () => {
    setIsSaving(true);
    try {
      const ok = await gaw.storage.save();
      if (ok) {
        gaw.toast.success('Saved database changes to local file!');
      }
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      gaw.toast.error('Failed to open file: ' + (err.message || String(err)));
    }
  };

  const handleExportDownload = () => {
    gaw.storage.exportDownload();
    gaw.toast.success('Exported and downloaded SQLite binary file.');
  };

  const handleSetPrimaryTarget = () => {
    gaw.storage.setActiveTarget('local');
    gaw.toast.success('Local File Storage is now your primary sync target!');
  };

  const handleIntervalChange = (val) => {
    const num = parseInt(val, 10);
    setAutoInterval(num);
    gaw.storage.setAutoSyncInterval(num);
    gaw.toast.info('Auto-save interval updated to ' + (num === 0 ? 'Off' : num + ' seconds'));
  };

  const handleToggleAuto = (enabled) => {
    setAutoEnabled(enabled);
    gaw.storage.setAutoSyncEnabled(enabled);
    gaw.toast.info('Local file auto-save ' + (enabled ? 'enabled' : 'disabled'));
  };

  const isLocalActive = meta.activeTarget === 'local';
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
              Directly synchronize SQLite changes with your local file system, configure auto-save intervals, and open databases.
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

      {/* Target Coordination Banner */}
      <div className={'p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ' + (
        isLocalActive
          ? isDark ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : isDark ? 'bg-blue-950/30 border-blue-700/50 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'
      )}>
        <div className="flex items-center gap-2.5">
          {isLocalActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Cloud className="w-4 h-4 text-blue-500" />}
          <div>
            <p className="font-bold">
              {isLocalActive
                ? 'Local File Storage is currently your Primary Active Sync Target'
                : 'Dropbox connection is currently in active use'}
            </p>
            <p className="text-[11px] opacity-80">
              {isLocalActive
                ? 'Automatic background saves write directly to your local database file handle.'
                : 'Assumption: No automatic local syncing is needed while Dropbox is active. You can still save or open local files.'}
            </p>
          </div>
        </div>
        {!isLocalActive && (
          <button
            onClick={handleSetPrimaryTarget}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition active:scale-95"
          >
            Switch Primary Sync to Local File
          </button>
        )}
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
              <span>Sync Status:</span>
              <span className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase ' + (
                meta.syncStatus === 'dirty'
                  ? isDark ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-amber-100 text-amber-800 border border-amber-300'
                  : isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              )}>
                {meta.syncStatus === 'dirty' ? 'Unsaved Edits in Memory' : 'All Changes Saved to Disk'}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleSaveNow}
              disabled={isSaving}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs shadow transition active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Now'}</span>
            </button>
            <button
              onClick={handleSaveAs}
              className={'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs border transition active:scale-95 ' + (
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Save As...</span>
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
            <span>Local Auto-Save Engine</span>
          </h2>

          <p className={'text-xs ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>
            When enabled and a file handle is attached, Gawkyy automatically flushes unwritten SQLite transactions to disk at the chosen interval.
          </p>

          <div className="space-y-4 pt-2">
            <label className={'flex items-center justify-between p-3 rounded-lg border cursor-pointer ' + (
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            )}>
              <div>
                <p className={'text-xs font-semibold ' + (isDark ? 'text-white' : 'text-slate-900')}>Enable Auto-Save to Disk</p>
                <p className={'text-[11px] ' + (isDark ? 'text-slate-400' : 'text-slate-500')}>Automatically persist memory writes to file</p>
              </div>
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => handleToggleAuto(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
              />
            </label>

            <div className="space-y-1.5">
              <label className={'text-xs font-medium ' + (isDark ? 'text-slate-300' : 'text-slate-700')}>Auto-Save Frequency:</label>
              <select
                value={autoInterval}
                onChange={(e) => handleIntervalChange(e.target.value)}
                className={'w-full px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-emerald-500 border ' + (
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                )}
              >
                <option value={5}>Every 5 seconds (Real-time safety)</option>
                <option value={10}>Every 10 seconds</option>
                <option value={30}>Every 30 seconds (Standard)</option>
                <option value={60}>Every 60 seconds</option>
                <option value={0}>Manual save only (Disabled)</option>
              </select>
            </div>

            <div className={'p-3 rounded-lg text-[11px] space-y-1 border ' + (
              isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            )}>
              <p className={'font-semibold ' + (isDark ? 'text-slate-300' : 'text-slate-800')}>File System Access Note:</p>
              <p>
                Browsers maintain an active write lock on your selected file handle during your session. If you switch to Dropbox mode, local auto-saves pause automatically.
              </p>
            </div>
          </div>
        </div>
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
  AlertTriangle
} from 'lucide-react';

export default function PluginManagerPlugin({ gaw }) {
  const [plugins, setPlugins] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
      return matchSearch && matchCategory && matchStatus;
    });
  }, [plugins, search, categoryFilter, statusFilter]);

  const activeCount = plugins.filter((p) => p.enabled !== 0).length;
  const inactiveCount = plugins.filter((p) => p.enabled === 0).length;

  const handleToggleActive = (plugin) => {
    if (plugin.id === 'plugin_manager' || plugin.id === 'plugin_local_storage' || plugin.id === 'plugin_file_manager') {
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
    if (deleteModalPlugin.id === 'plugin_manager' || deleteModalPlugin.id === 'plugin_local_storage' || deleteModalPlugin.id === 'plugin_file_manager') {
      gaw.toast.warning('Core system plugins (Plugin Manager, Local Storage & File Manager) cannot be removed.');
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
    ].join('\n');

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
        <div className="relative flex-1 min-w-[200px]">
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
          const isProtected = p.id === 'plugin_manager' || p.id === 'plugin_local_storage' || p.id === 'plugin_file_manager';
          return (
            <div
              key={p.id}
              className={'p-5 rounded-xl border transition-all flex flex-col justify-between ' + (
                isActive
                  ? isDark
                    ? 'bg-slate-950/80 border-slate-800/90 shadow-md hover:border-indigo-500/50'
                    : 'bg-white border-slate-200 shadow-sm hover:border-indigo-400'
                  : isDark
                  ? 'bg-slate-950/40 border-slate-800/40 opacity-70'
                  : 'bg-slate-50 border-slate-200 opacity-70'
              )}
            >
              <div className="space-y-3">
                {/* Header: Title, Category, Toggle */}
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
                    <span className={'inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ' + (
                      isDark ? 'bg-indigo-950/80 border-indigo-700/50 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    )}>
                      {p.menu_category || 'Custom'}
                    </span>
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
