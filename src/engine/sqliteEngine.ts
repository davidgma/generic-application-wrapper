import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { ColumnInfo, QueryResult, TableSchema, SavedQuery } from '../types/sqlite';
import { PluginRecord } from '../types/plugin';
import { SavedReport } from '../types/report';
import {
  DEFAULT_CRM_PLUGIN_CODE,
  DEFAULT_INVENTORY_PLUGIN_CODE,
  DEFAULT_EXECUTIVE_PLUGIN_CODE,
  DEFAULT_HELLO_WORLD_PLUGIN_CODE,
  DEFAULT_DROPBOX_PLUGIN_CODE,
  DEFAULT_LOCAL_STORAGE_PLUGIN_CODE,
  DEFAULT_PLUGIN_MANAGER_CODE,
} from './defaultPlugins';

export class SQLiteEngine {
  private static instance: SQLiteEngine | null = null;
  private sqlJs: SqlJsStatic | null = null;
  private db: Database | null = null;
  private listeners: Set<() => void> = new Set();
  private isInitializing: Promise<void> | null = null;
  public activeDbName: string = 'northwind_commerce.db';

  private constructor() {}

  public static getInstance(): SQLiteEngine {
    if (!SQLiteEngine.instance) {
      SQLiteEngine.instance = new SQLiteEngine();
    }
    return SQLiteEngine.instance;
  }

  public async init(binaryData?: Uint8Array, dbName?: string): Promise<void> {
    if (this.isInitializing) {
      await this.isInitializing;
      if (binaryData && this.sqlJs) {
        this.loadBinary(binaryData, dbName);
      }
      return;
    }

    this.isInitializing = (async () => {
      if (!this.sqlJs) {
        this.sqlJs = await initSqlJs({
          locateFile: (file) => (file.endsWith('.wasm') ? '/sql-wasm.wasm' : file),
        });
      }

      if (binaryData) {
        this.loadBinary(binaryData, dbName);
      } else if (!this.db) {
        this.createDefaultDatabase();
      }
      this.ensureSystemTables();
    })();

    await this.isInitializing;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notifyChange(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('SQLiteEngine listener error:', err);
      }
    });
  }

  public createDefaultDatabase(): void {
    if (!this.sqlJs) throw new Error('SQL.js not initialized');
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        // ignore
      }
    }

    this.db = new this.sqlJs.Database();
    this.activeDbName = 'northwind_commerce.db';

    // 1. Create System Tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS t_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS t_plugins (
        id TEXT PRIMARY KEY,
        name TEXT,
        version TEXT,
        enabled INTEGER,
        icon TEXT,
        menu_category TEXT,
        route TEXT,
        description TEXT,
        code TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS t_sql_queries (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        query TEXT,
        params TEXT,
        layout TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS t_reports (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        query_id TEXT,
        custom_sql TEXT,
        config TEXT,
        created_at TEXT
      );
    `);

    // 2. Insert Settings
    const now = new Date().toISOString();
    const settings = [
      ['app_title', 'Northwind Modern Commerce', now],
      ['theme', 'vs-dark', now],
      ['auto_sync_interval', '30', now],
      ['version', '1.0.0', now],
      ['company_name', 'Northwind Global Corp', now],
      ['author', 'GAW Studio', now],
    ];

    for (const [k, v, u] of settings) {
      this.db.run('INSERT INTO t_settings (key, value, updated_at) VALUES (?, ?, ?)', [k, v, u]);
    }

    // 3. Create Sample Business Schema & Populate Data
    this.seedBusinessData();

    // 4. Seed Saved Queries
    this.seedSavedQueries();

    // 5. Seed Reports
    this.seedSavedReports();

    // 6. Seed Built-In TSX Plugins
    this.seedPlugins();

    this.notifyChange();
  }

  private seedBusinessData(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        category_id INTEGER,
        unit_price REAL NOT NULL,
        units_in_stock INTEGER NOT NULL,
        reorder_level INTEGER NOT NULL,
        is_discontinued INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        contact_name TEXT,
        contact_title TEXT,
        city TEXT,
        country TEXT,
        phone TEXT,
        credit_limit REAL DEFAULT 5000,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT
      );

      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        order_date TEXT NOT NULL,
        required_date TEXT,
        shipped_date TEXT,
        ship_country TEXT,
        ship_city TEXT,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'COMPLETED',
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );

      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        discount REAL DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // Insert categories
    const categories = [
      [1, 'Beverages', 'Soft drinks, coffees, teas, beers, and ales'],
      [2, 'Condiments', 'Sweet and savory sauces, relishes, spreads, and seasonings'],
      [3, 'Confections', 'Desserts, candies, and sweet breads'],
      [4, 'Dairy Products', 'Cheeses and artisanal butter'],
      [5, 'Grains & Cereals', 'Breads, crackers, pasta, and cereal'],
    ];
    for (const cat of categories) {
      this.db.run('INSERT INTO categories VALUES (?, ?, ?)', cat);
    }

    // Insert products
    const products = [
      [1, 'Chai Tea Latte Blend', 'BEV-001', 1, 18.00, 39, 10, 0],
      [2, 'Chang Artisan Beer', 'BEV-002', 1, 19.00, 17, 25, 0],
      [3, 'Aniseed Organic Syrup', 'CON-001', 2, 10.00, 13, 25, 0],
      [4, 'Chef Anton Cajun Seasoning', 'CON-002', 2, 22.00, 53, 10, 0],
      [5, 'Chef Anton Gumbo Mix', 'CON-003', 2, 21.35, 8, 20, 0],
      [6, "Grandma's Boysenberry Spread", 'CON-004', 2, 25.00, 120, 25, 0],
      [7, "Uncle Bob's Organic Dried Pears", 'CON-005', 3, 30.00, 15, 10, 0],
      [8, 'Northwoods Cranberry Sauce', 'CON-006', 2, 40.00, 6, 15, 0],
      [9, 'Mishi Kobe A5 Beef Jerky', 'CON-007', 3, 97.00, 29, 30, 0],
      [10, 'Ikura Alaskan Salmon Caviar', 'BEV-003', 1, 31.00, 31, 0, 0],
      [11, 'Queso Cabrales Blue', 'DAI-001', 4, 21.00, 22, 30, 0],
      [12, 'Queso Manchego La Pastora', 'DAI-002', 4, 38.00, 86, 20, 0],
      [13, 'Konbu Dried Kelp Strips', 'CON-008', 2, 6.00, 24, 5, 0],
      [14, 'Tofu Fresh Organic Silk', 'CON-009', 2, 23.25, 35, 10, 0],
      [15, 'Genen Shouyu Low Sodium Soy', 'CON-010', 2, 15.50, 39, 5, 0],
      [16, 'Pavlova Australian Meringue', 'CON-011', 3, 17.45, 29, 10, 0],
      [17, 'Alice Springs Lamb Cuts', 'CON-012', 3, 39.00, 0, 10, 1],
      [18, 'Carnarvon Tiger Prawns', 'BEV-004', 1, 62.50, 42, 15, 0],
      [19, 'Teatime Crisp Biscuits', 'CON-013', 3, 9.20, 25, 10, 0],
      [20, "Sir Rodney's Marmalade", 'CON-014', 3, 81.00, 40, 15, 0],
      [21, 'Gustaf Knäckebröd Rye Crisp', 'GRA-001', 5, 21.00, 104, 25, 0],
      [22, 'Tunnbröd Soft Flatbread', 'GRA-002', 5, 9.00, 61, 15, 0],
    ];
    for (const prod of products) {
      this.db.run('INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?)', prod);
    }

    // Insert customers
    const customers = [
      ['ALFKI', 'Alfreds Futterkiste', 'Maria Anders', 'Sales Representative', 'Berlin', 'Germany', '030-0074321', 15000, 'ACTIVE', '2025-01-10'],
      ['ANATR', 'Ana Trujillo Emparedados', 'Ana Trujillo', 'Owner', 'México D.F.', 'Mexico', '(5) 555-4729', 8000, 'ACTIVE', '2025-01-15'],
      ['ANTON', 'Antonio Moreno Taquería', 'Antonio Moreno', 'Owner', 'México D.F.', 'Mexico', '(5) 555-3932', 12000, 'VIP', '2025-01-20'],
      ['AROUT', 'Around the Horn', 'Thomas Hardy', 'Sales Representative', 'London', 'UK', '(171) 555-7788', 25000, 'ACTIVE', '2025-01-22'],
      ['BERGS', 'Berglunds snabbköp', 'Christina Berglund', 'Order Administrator', 'Luleå', 'Sweden', '0921-12 34 65', 18000, 'ACTIVE', '2025-02-01'],
      ['BLAUS', 'Blauer See Delikatessen', 'Hanna Moos', 'Sales Representative', 'Mannheim', 'Germany', '0621-08460', 10000, 'HOLD', '2025-02-05'],
      ['BLONP', 'Blondel père et fils', 'Frédérique Citeaux', 'Marketing Manager', 'Strasbourg', 'France', '88.60.15.31', 22000, 'ACTIVE', '2025-02-12'],
      ['BOLID', 'Bólido Comidas preparadas', 'Martín Sommer', 'Owner', 'Madrid', 'Spain', '(91) 555 22 82', 14000, 'ACTIVE', '2025-02-18'],
      ['BONAP', 'Bon app\'', 'Laurence Lebihan', 'Owner', 'Marseille', 'France', '91.24.45.40', 35000, 'VIP', '2025-03-01'],
      ['BOTTM', 'Bottom-Dollar Markets', 'Elizabeth Lincoln', 'Accounting Manager', 'Tsawwassen', 'Canada', '(604) 555-4729', 28000, 'ACTIVE', '2025-03-05'],
      ['BSBEV', 'B\'s Beverages', 'Victoria Ashworth', 'Sales Representative', 'London', 'UK', '(171) 555-1212', 11000, 'ACTIVE', '2025-03-10'],
      ['CACTU', 'Cactus Comidas para llevar', 'Patricio Simpson', 'Sales Agent', 'Buenos Aires', 'Argentina', '(1) 135-5555', 7500, 'ACTIVE', '2025-03-14'],
      ['COMMI', 'Comércio Mineiro', 'Pedro Afonso', 'Sales Associate', 'São Paulo', 'Brazil', '(11) 555-7640', 9500, 'HOLD', '2025-03-20'],
      ['CONSH', 'Consolidated Holdings', 'Elizabeth Brown', 'Sales Representative', 'London', 'UK', '(171) 555-2282', 40000, 'VIP', '2025-03-25'],
      ['DRACD', 'Drachenblut Delikatessen', 'Sven Ottlieb', 'Order Administrator', 'Aachen', 'Germany', '0241-039123', 19000, 'ACTIVE', '2025-04-02'],
    ];
    for (const cust of customers) {
      this.db.run('INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', cust);
    }

    // Insert orders & order items
    const orders = [
      ['ORD-10248', 'ALFKI', '2026-08-04', '2026-09-01', '2026-08-16', 'Germany', 'Berlin', 440.00, 'COMPLETED'],
      ['ORD-10249', 'ANATR', '2026-08-05', '2026-09-02', '2026-08-10', 'Mexico', 'México D.F.', 1863.40, 'COMPLETED'],
      ['ORD-10250', 'ANTON', '2026-08-08', '2026-09-05', '2026-08-12', 'Mexico', 'México D.F.', 1553.00, 'COMPLETED'],
      ['ORD-10251', 'AROUT', '2026-08-08', '2026-09-05', '2026-08-15', 'UK', 'London', 654.06, 'COMPLETED'],
      ['ORD-10252', 'BERGS', '2026-08-09', '2026-09-06', '2026-08-11', 'Sweden', 'Luleå', 3597.90, 'COMPLETED'],
      ['ORD-10253', 'BLONP', '2026-08-10', '2026-08-24', '2026-08-16', 'France', 'Strasbourg', 1444.80, 'COMPLETED'],
      ['ORD-10254', 'BOLID', '2026-08-11', '2026-09-08', '2026-08-23', 'Spain', 'Madrid', 617.60, 'COMPLETED'],
      ['ORD-10255', 'BONAP', '2026-08-12', '2026-09-09', '2026-08-15', 'France', 'Marseille', 2490.50, 'COMPLETED'],
      ['ORD-10256', 'BOTTM', '2026-08-15', '2026-09-12', '2026-08-17', 'Canada', 'Tsawwassen', 517.80, 'COMPLETED'],
      ['ORD-10257', 'BSBEV', '2026-08-16', '2026-09-13', '2026-08-22', 'UK', 'London', 1119.90, 'COMPLETED'],
      ['ORD-10258', 'CACTU', '2026-08-17', '2026-09-14', '2026-08-23', 'Argentina', 'Buenos Aires', 2018.60, 'PROCESSING'],
      ['ORD-10259', 'CONSH', '2026-08-18', '2026-09-15', '2026-08-25', 'UK', 'London', 4385.20, 'PROCESSING'],
      ['ORD-10260', 'DRACD', '2026-08-19', '2026-09-16', '2026-08-29', 'Germany', 'Aachen', 1504.65, 'SHIPPED'],
      ['ORD-10261', 'ALFKI', '2026-08-20', '2026-09-17', null, 'Germany', 'Berlin', 872.00, 'PENDING'],
      ['ORD-10262', 'BONAP', '2026-08-22', '2026-09-19', null, 'France', 'Marseille', 3120.00, 'PENDING'],
    ];
    for (const ord of orders) {
      this.db.run('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ord);
    }

    const items = [
      ['ORD-10248', 1, 14.00, 12, 0],
      ['ORD-10248', 2, 9.80, 10, 0],
      ['ORD-10249', 4, 18.60, 40, 0],
      ['ORD-10249', 6, 25.00, 45, 0.05],
      ['ORD-10250', 10, 31.00, 35, 0.15],
      ['ORD-10250', 11, 21.00, 15, 0.15],
      ['ORD-10251', 13, 6.00, 6, 0.05],
      ['ORD-10251', 14, 23.25, 20, 0],
      ['ORD-10252', 9, 97.00, 25, 0.20],
      ['ORD-10252', 12, 38.00, 30, 0.05],
      ['ORD-10253', 2, 19.00, 40, 0],
      ['ORD-10254', 16, 17.45, 20, 0.10],
      ['ORD-10255', 18, 62.50, 30, 0],
      ['ORD-10256', 21, 21.00, 15, 0],
      ['ORD-10257', 3, 10.00, 20, 0],
      ['ORD-10258', 20, 81.00, 18, 0.05],
      ['ORD-10259', 18, 62.50, 50, 0.10],
      ['ORD-10260', 11, 21.00, 45, 0],
      ['ORD-10261', 1, 18.00, 24, 0],
      ['ORD-10262', 9, 97.00, 30, 0.05],
    ];
    for (const itm of items) {
      this.db.run('INSERT INTO order_items (order_id, product_id, unit_price, quantity, discount) VALUES (?, ?, ?, ?, ?)', itm);
    }
  }

  private seedSavedQueries(): void {
    if (!this.db) return;
    const queries = [
      {
        id: 'q_active_customers',
        name: 'All Active Customers',
        description: 'Complete listing of customers with verified credit limits and statuses.',
        query: `SELECT id, company_name, contact_name, contact_title, city, country, phone, credit_limit, status FROM customers ORDER BY company_name ASC;`,
      },
      {
        id: 'q_revenue_by_country',
        name: 'Revenue by Ship Country',
        description: 'Aggregated total sales volume, order count, and average order value by shipping destination.',
        query: `SELECT ship_country, COUNT(id) AS total_orders, ROUND(SUM(total_amount), 2) AS total_revenue, ROUND(AVG(total_amount), 2) AS avg_order_value FROM orders GROUP BY ship_country ORDER BY total_revenue DESC;`,
      },
      {
        id: 'q_top_products',
        name: 'Top Selling Products & Margins',
        description: 'Product velocity, total units sold, and aggregate gross revenue per SKU.',
        query: `SELECT p.name AS product_name, c.name AS category, p.unit_price, p.units_in_stock, SUM(oi.quantity) AS units_sold, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_sales FROM order_items oi JOIN products p ON oi.product_id = p.id JOIN categories c ON p.category_id = c.id GROUP BY p.id ORDER BY total_sales DESC;`,
      },
      {
        id: 'q_low_stock',
        name: 'Low Stock Inventory Alert',
        description: 'Critical stock levels where inventory is at or below recommended reorder threshold.',
        query: `SELECT id, name, sku, units_in_stock, reorder_level, unit_price FROM products WHERE units_in_stock <= reorder_level ORDER BY units_in_stock ASC;`,
      },
      {
        id: 'q_multi_exec_overview',
        name: 'Multi-Table Executive Overview',
        description: 'Multi-part SQL query returning 3 separate analytical tables in a single transaction.',
        query: `SELECT COUNT(*) AS total_customers, (SELECT COUNT(*) FROM orders) AS total_orders, (SELECT ROUND(SUM(total_amount), 2) FROM orders) AS gross_revenue FROM customers;\n\nSELECT status, COUNT(*) AS order_count, ROUND(SUM(total_amount), 2) AS status_revenue FROM orders GROUP BY status;\n\nSELECT c.name AS category_name, COUNT(p.id) AS product_count, SUM(p.units_in_stock) AS total_inventory FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id;`,
      },
    ];

    const now = new Date().toISOString();
    for (const q of queries) {
      this.db.run(
        'INSERT INTO t_sql_queries (id, name, description, query, params, layout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [q.id, q.name, q.description, q.query, '{}', '{}', now]
      );
    }
  }

  private seedSavedReports(): void {
    if (!this.db) return;
    const now = new Date().toISOString();

    const execReportConfig = {
      companyName: 'Northwind Global Enterprises',
      reportTitle: 'Executive Performance & Sales Brief',
      subtitle: 'Q3 Financial Snapshot & Territory Distribution',
      preparedBy: 'GAW Analytics Engine',
      periodText: 'Trailing 90 Days',
      notes: 'All currency figures represent completed and pipeline orders recorded in local SQLite database store.',
      kpiCards: [
        { id: 'kpi-1', title: 'Gross Bookings', queryIndex: 0, valueColumn: 'gross_revenue', format: 'currency' },
        { id: 'kpi-2', title: 'Total Invoices', queryIndex: 0, valueColumn: 'total_orders', format: 'number' },
        { id: 'kpi-3', title: 'Corporate Clients', queryIndex: 0, valueColumn: 'total_customers', format: 'number' },
      ],
      charts: [
        { id: 'ch-1', title: 'Revenue Distribution by Order Status', chartType: 'bar', queryIndex: 1, labelColumn: 'status', valueColumn: 'status_revenue', color: '#6366f1' },
      ],
      tables: [
        { id: 'tb-1', title: 'Order Status Breakdown', queryIndex: 1, showTotalRow: true },
        { id: 'tb-2', title: 'Inventory Distribution by Category', queryIndex: 2, showTotalRow: true },
      ],
    };

    this.db.run(
      'INSERT INTO t_reports (id, name, description, query_id, custom_sql, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        'report_exec_overview',
        'Executive Sales & Operations Report',
        'Publication-ready executive memo with KPI cards, revenue charts, and inventory summaries.',
        'q_multi_exec_overview',
        '',
        JSON.stringify(execReportConfig),
        now,
      ]
    );

    const inventoryReportConfig = {
      companyName: 'Northwind Supply Chain Desk',
      reportTitle: 'Warehouse Inventory & Reorder Notice',
      subtitle: 'Critical Low Stock and Discontinued Product Review',
      preparedBy: 'Operations & Fulfillment',
      periodText: 'Immediate Action Required',
      notes: 'Procurement team should execute purchase orders for all line items highlighted below.',
      kpiCards: [
        { id: 'kpi-inv-1', title: 'Critical Line Items', queryIndex: 0, valueColumn: 'id', format: 'number', subtitle: 'SKUs at or below reorder mark' },
      ],
      charts: [
        { id: 'ch-inv-1', title: 'Units in Stock by Critical SKU', chartType: 'bar', queryIndex: 0, labelColumn: 'name', valueColumn: 'units_in_stock', color: '#f59e0b' },
      ],
      tables: [
        { id: 'tb-inv-1', title: 'Low Stock Item Master List', queryIndex: 0, showTotalRow: false },
      ],
    };

    this.db.run(
      'INSERT INTO t_reports (id, name, description, query_id, custom_sql, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        'report_inventory_reorder',
        'Inventory Valuation & Reorder Notice',
        'Stock reorder report showing critical warehouse thresholds and replacement costs.',
        'q_low_stock',
        '',
        JSON.stringify(inventoryReportConfig),
        now,
      ]
    );
  }

  private seedPlugins(): void {
    if (!this.db) return;
    const now = new Date().toISOString();

    const plugins = [
      {
        id: 'plugin_crm',
        name: 'Customer Directory & CRM',
        version: '1.2.0',
        enabled: 1,
        icon: 'Users',
        menu_category: 'Commercial',
        route: '/crm',
        description: 'Interactive account manager with live SQLite search, credit limit controls, and account dossier.',
        code: DEFAULT_CRM_PLUGIN_CODE,
      },
      {
        id: 'plugin_inventory',
        name: 'Inventory Valuation & Reorder Desk',
        version: '1.1.0',
        enabled: 1,
        icon: 'Boxes',
        menu_category: 'Logistics',
        route: '/inventory',
        description: 'Warehouse asset monitoring, threshold sliders, batch restock actions, and spreadsheet exports.',
        code: DEFAULT_INVENTORY_PLUGIN_CODE,
      },
      {
        id: 'plugin_executive',
        name: 'Executive Pulse & Financial Overview',
        version: '1.0.0',
        enabled: 1,
        icon: 'TrendingUp',
        menu_category: 'Analytics',
        route: '/pulse',
        description: 'High-level business telemetry, order velocity, and recent transactions view.',
        code: DEFAULT_EXECUTIVE_PLUGIN_CODE,
      },
      {
        id: 'plugin_hello_world',
        name: 'Hello World Starter',
        version: '1.0.0',
        enabled: 1,
        icon: 'Sparkles',
        menu_category: 'Examples',
        route: '/hello-world',
        description: 'Clean starter plugin demonstrating how to query SQLite, show notifications, and use React state in GAW.',
        code: DEFAULT_HELLO_WORLD_PLUGIN_CODE,
      },
      {
        id: 'plugin_dropbox_sync',
        name: 'Dropbox Cloud Sync',
        version: '1.0.0',
        enabled: 1,
        icon: 'Cloud',
        menu_category: 'System & Cloud',
        route: '/dropbox-sync',
        description: 'Connect to Dropbox, monitor cloud sync status, configure auto-sync interval, push/pull databases, and browse remote files.',
        code: DEFAULT_DROPBOX_PLUGIN_CODE,
      },
      {
        id: 'plugin_local_storage',
        name: 'Local Storage & Disk Sync',
        version: '1.0.0',
        enabled: 1,
        icon: 'HardDrive',
        menu_category: 'System & Storage',
        route: '/local-storage',
        description: 'Manage local disk database saving, File System Access API handles, auto-save timers, direct exports, and file opening.',
        code: DEFAULT_LOCAL_STORAGE_PLUGIN_CODE,
      },
      {
        id: 'plugin_manager',
        name: 'Plugin Manager',
        version: '1.0.0',
        enabled: 1,
        icon: 'Puzzle',
        menu_category: 'System & Plugins',
        route: '/plugin-manager',
        description: 'Manage dynamic TSX plugins: toggle active/inactive, import new plugins from disk/Dropbox/blank, open in IDE, and remove plugins safely.',
        code: DEFAULT_PLUGIN_MANAGER_CODE,
      },
    ];

    for (const p of plugins) {
      this.db.run(
        'INSERT INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.name, p.version, p.enabled, p.icon, p.menu_category, p.route, p.description, p.code, now, now]
      );
    }
  }

  public query(sql: string, params?: any[]): { columns: string[]; values: any[][] } {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      const values: any[][] = [];
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        values.push(stmt.get());
      }
      return { columns, values };
    } finally {
      stmt.free();
    }
  }

  public queryObjects<T = Record<string, any>>(sql: string, params?: any[]): T[] {
    const { columns, values } = this.query(sql, params);
    return values.map((row) => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as T;
    });
  }

  public run(sql: string, params?: any[]): { rowsAffected: number } {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    const affected = this.db.getRowsModified();
    this.notifyChange();
    return { rowsAffected: affected };
  }

  /**
   * Split SQL statements by semicolon (ignoring semicolons inside strings or comments)
   * and execute each statement, collecting statistics.
   */
  public exec(sql: string): QueryResult[] {
    if (!this.db) throw new Error('Database not initialized');

    // Split on semicolons that are not inside quotes
    const statements = this.splitSqlStatements(sql);
    const results: QueryResult[] = [];

    let hasMutations = false;

    for (const stmtStr of statements) {
      const trimmed = stmtStr.trim();
      if (!trimmed) continue;

      const startTime = performance.now();
      try {
        // Test if this is a SELECT or PRAGMA that returns rows
        const isQuery = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);

        if (isQuery) {
          const { columns, values } = this.query(trimmed);
          const execTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
          results.push({
            columns,
            values,
            execTimeMs,
            sqlQuery: trimmed,
          });
        } else {
          this.db.run(trimmed);
          const execTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
          const rowsAffected = this.db.getRowsModified();
          hasMutations = true;
          results.push({
            columns: ['status', 'rows_affected'],
            values: [['Executed successfully', rowsAffected]],
            execTimeMs,
            rowsAffected,
            sqlQuery: trimmed,
          });
        }
      } catch (err: any) {
        const execTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
        results.push({
          columns: ['error'],
          values: [[err.message || String(err)]],
          execTimeMs,
          sqlQuery: trimmed,
          error: err.message || String(err),
        });
      }
    }

    if (hasMutations) {
      this.notifyChange();
    }

    return results;
  }

  private splitSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1] || '';

      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        current += char;
        continue;
      }

      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          current += '*/';
          i++;
          continue;
        }
        current += char;
        continue;
      }

      if (char === '-' && nextChar === '-' && !inSingleQuote && !inDoubleQuote) {
        inLineComment = true;
        current += '--';
        i++;
        continue;
      }

      if (char === '/' && nextChar === '*' && !inSingleQuote && !inDoubleQuote) {
        inBlockComment = true;
        current += '/*';
        i++;
        continue;
      }

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (char === ';' && !inSingleQuote && !inDoubleQuote) {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  public getSchema(): TableSchema[] {
    if (!this.db) return [];
    try {
      const tablesResult = this.query(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
      );

      const schemas: TableSchema[] = [];

      for (const row of tablesResult.values) {
        const name = String(row[0]);
        const type = (row[1] === 'view' ? 'view' : 'table') as 'table' | 'view';
        const isSystem = name.startsWith('t_');

        // Column info via PRAGMA
        const colRes = this.query(`PRAGMA table_info("${name}");`);
        const columns: ColumnInfo[] = colRes.values.map((c) => ({
          cid: Number(c[0]),
          name: String(c[1]),
          type: String(c[2] || 'TEXT'),
          notnull: Number(c[3]),
          dflt_value: c[4],
          pk: Number(c[5]),
        }));

        // Row count
        let rowCount = 0;
        try {
          const countRes = this.query(`SELECT COUNT(*) FROM "${name}";`);
          if (countRes.values.length > 0) {
            rowCount = Number(countRes.values[0][0]) || 0;
          }
        } catch (e) {
          // ignore error for views
        }

        schemas.push({
          name,
          type,
          columns,
          rowCount,
          isSystem,
        });
      }

      return schemas;
    } catch (err) {
      console.error('getSchema error:', err);
      return [];
    }
  }

  public exportBinary(): Uint8Array {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.export();
  }

  public loadBinary(data: Uint8Array, dbName?: string): void {
    if (!this.sqlJs) throw new Error('SQL.js not initialized');
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        // ignore
      }
    }
    this.db = new this.sqlJs.Database(data);
    if (dbName) {
      this.activeDbName = dbName;
    }
    this.ensureSystemTables();
    this.notifyChange();
  }

  private ensureSystemTables(): void {
    if (!this.db) return;
    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS t_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS t_plugins (id TEXT PRIMARY KEY, name TEXT, version TEXT, enabled INTEGER, icon TEXT, menu_category TEXT, route TEXT, description TEXT, code TEXT, created_at TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS t_sql_queries (id TEXT PRIMARY KEY, name TEXT, description TEXT, query TEXT, params TEXT, layout TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS t_reports (id TEXT PRIMARY KEY, name TEXT, description TEXT, query_id TEXT, custom_sql TEXT, config TEXT, created_at TEXT);
      `);

      // Ensure default system & example plugins exist
      const defaultPluginsToCheck = [
        {
          id: 'plugin_crm',
          name: 'Customer Directory & CRM',
          version: '1.0.0',
          enabled: 1,
          icon: 'Users',
          category: 'Business',
          route: '/crm',
          desc: 'Manage client accounts, credit limits, and orders directly inside this .db file.',
          code: DEFAULT_CRM_PLUGIN_CODE,
        },
        {
          id: 'plugin_inventory',
          name: 'Inventory Valuation Desk',
          version: '1.0.0',
          enabled: 1,
          icon: 'Package',
          category: 'Operations',
          route: '/inventory',
          desc: 'Monitor real-time warehouse inventory value, low-stock triggers, and execute immediate batch restocks.',
          code: DEFAULT_INVENTORY_PLUGIN_CODE,
        },
        {
          id: 'plugin_executive',
          name: 'Executive Pulse',
          version: '1.0.0',
          enabled: 1,
          icon: 'BarChart3',
          category: 'Business',
          route: '/executive',
          desc: 'Aggregated business KPIs computed directly from SQLite relational tables.',
          code: DEFAULT_EXECUTIVE_PLUGIN_CODE,
        },
        {
          id: 'plugin_hello_world',
          name: 'Hello World Starter',
          version: '1.0.0',
          enabled: 1,
          icon: 'Sparkles',
          category: 'Examples',
          route: '/hello-world',
          desc: 'Clean starter plugin demonstrating how to query SQLite, show notifications, and use React state in GAW.',
          code: DEFAULT_HELLO_WORLD_PLUGIN_CODE,
        },
        {
          id: 'plugin_dropbox_sync',
          name: 'Dropbox Cloud Sync',
          version: '1.0.0',
          enabled: 1,
          icon: 'Cloud',
          category: 'System & Cloud',
          route: '/dropbox-sync',
          desc: 'Connect to Dropbox, monitor cloud sync status, configure auto-sync interval, push/pull databases, and browse remote files.',
          code: DEFAULT_DROPBOX_PLUGIN_CODE,
        },
        {
          id: 'plugin_local_storage',
          name: 'Local Storage & Disk Sync',
          version: '1.0.0',
          enabled: 1,
          icon: 'HardDrive',
          category: 'System & Storage',
          route: '/local-storage',
          desc: 'Manage local disk database saving, File System Access API handles, auto-save timers, direct exports, and file opening.',
          code: DEFAULT_LOCAL_STORAGE_PLUGIN_CODE,
        },
        {
          id: 'plugin_manager',
          name: 'Plugin Manager',
          version: '1.0.0',
          enabled: 1,
          icon: 'Puzzle',
          category: 'System & Plugins',
          route: '/plugin-manager',
          desc: 'Manage dynamic TSX plugins: toggle active/inactive, import new plugins from disk/Dropbox/blank, open in IDE, and remove plugins safely.',
          code: DEFAULT_PLUGIN_MANAGER_CODE,
        },
      ];

      const now = new Date().toISOString();
      for (const p of defaultPluginsToCheck) {
        const check = this.db.exec("SELECT id FROM t_plugins WHERE id = '" + p.id + "';");
        if (!check || check.length === 0 || !check[0].values || check[0].values.length === 0) {
          this.db.run(
            'INSERT OR IGNORE INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [p.id, p.name, p.version, p.enabled, p.icon, p.category, p.route, p.desc, p.code, now, now]
          );
        } else {
          // Update default system and template plugins to latest working code
          this.db.run(
            'UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?;',
            [p.code, now, p.id]
          );
        }
      }
    } catch (err) {
      console.error('ensureSystemTables error:', err);
    }
  }

  public getPlugins(): PluginRecord[] {
    try {
      return this.queryObjects<PluginRecord>('SELECT * FROM t_plugins ORDER BY name ASC;');
    } catch (e) {
      return [];
    }
  }

  public setPluginEnabled(pluginId: string, enabled: boolean): void {
    if ((pluginId === 'plugin_manager' || pluginId === 'plugin_local_storage') && !enabled) {
      console.warn('Cannot disable core system plugin:', pluginId);
      return;
    }
    if (!this.db) return;
    this.run('UPDATE t_plugins SET enabled = ?, updated_at = ? WHERE id = ?;', [
      enabled ? 1 : 0,
      new Date().toISOString(),
      pluginId,
    ]);
    this.notifyChange();
  }

  public deletePlugin(pluginId: string): void {
    if (pluginId === 'plugin_manager' || pluginId === 'plugin_local_storage') {
      console.warn('Cannot delete core system plugin:', pluginId);
      return;
    }
    if (!this.db) return;
    this.run('DELETE FROM t_plugins WHERE id = ?;', [pluginId]);
    this.notifyChange();
  }

  public savePlugin(plugin: Partial<PluginRecord> & { id: string; name: string; code: string }): void {
    if (!this.db) return;
    const now = new Date().toISOString();
    const existing = this.queryObjects<PluginRecord>('SELECT * FROM t_plugins WHERE id = ? LIMIT 1;', [plugin.id]);
    if (existing && existing.length > 0) {
      this.run(
        `UPDATE t_plugins SET
           name = ?,
           version = ?,
           enabled = ?,
           icon = ?,
           menu_category = ?,
           route = ?,
           description = ?,
           code = ?,
           updated_at = ?
         WHERE id = ?;`,
        [
          plugin.name,
          plugin.version || existing[0].version || '1.0.0',
          plugin.enabled !== undefined ? (plugin.enabled ? 1 : 0) : existing[0].enabled,
          plugin.icon || existing[0].icon || 'Puzzle',
          plugin.menu_category || existing[0].menu_category || 'Custom',
          plugin.route || existing[0].route || ('/' + plugin.id),
          plugin.description || existing[0].description || '',
          plugin.code,
          now,
          plugin.id,
        ]
      );
    } else {
      this.run(
        `INSERT INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          plugin.id,
          plugin.name,
          plugin.version || '1.0.0',
          plugin.enabled !== undefined ? (plugin.enabled ? 1 : 0) : 1,
          plugin.icon || 'Puzzle',
          plugin.menu_category || 'Custom',
          plugin.route || ('/' + plugin.id),
          plugin.description || '',
          plugin.code,
          now,
          now,
        ]
      );
    }
    this.notifyChange();
  }

  public getSavedQueries(): SavedQuery[] {
    try {
      return this.queryObjects<SavedQuery>('SELECT * FROM t_sql_queries ORDER BY name ASC;');
    } catch (e) {
      return [];
    }
  }

  public getSavedReports(): SavedReport[] {
    try {
      return this.queryObjects<SavedReport>('SELECT * FROM t_reports ORDER BY name ASC;');
    } catch (e) {
      return [];
    }
  }

  public getSetting(key: string, defaultValue: string = ''): string {
    try {
      const res = this.queryObjects<{ value: string }>('SELECT value FROM t_settings WHERE key = ? LIMIT 1;', [key]);
      return res.length > 0 ? res[0].value : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  public setSetting(key: string, value: string): void {
    const now = new Date().toISOString();
    this.run('INSERT OR REPLACE INTO t_settings (key, value, updated_at) VALUES (?, ?, ?);', [key, value, now]);
    this.notifyChange();
  }

  public isSystemTable(tableName: string): boolean {
    return (
      tableName.startsWith('t_') ||
      tableName.startsWith('sqlite_') ||
      tableName.startsWith('_gaw_')
    );
  }

  public getTableDDL(tableName: string): string {
    if (!this.db) return '';
    try {
      const res = this.query("SELECT sql FROM sqlite_master WHERE (type='table' OR type='view') AND name = ?;", [tableName]);
      if (res.values.length > 0 && res.values[0][0]) {
        return String(res.values[0][0]);
      }
    } catch (e) {
      console.error('getTableDDL error:', e);
    }
    return `-- Table schema definition for "${tableName}" not found.`;
  }

  public deleteTable(tableName: string): void {
    if (this.isSystemTable(tableName)) {
      throw new Error(`Cannot delete system table: ${tableName}`);
    }
    this.run(`DROP TABLE IF EXISTS "${tableName}";`);
    this.notifyChange();
  }

  public deleteQuery(id: string): void {
    this.run('DELETE FROM t_sql_queries WHERE id = ?;', [id]);
    this.notifyChange();
  }

  public deleteReport(id: string): void {
    this.run('DELETE FROM t_reports WHERE id = ?;', [id]);
    this.notifyChange();
  }

  public saveReport(report: SavedReport): void {
    const now = new Date().toISOString();
    this.run(
      'INSERT OR REPLACE INTO t_reports (id, name, description, query_id, custom_sql, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
      [
        report.id,
        report.name,
        report.description || '',
        report.query_id || '',
        report.custom_sql || '',
        typeof report.config === 'string' ? report.config : JSON.stringify(report.config),
        report.created_at || now,
      ]
    );
    this.notifyChange();
  }
}
