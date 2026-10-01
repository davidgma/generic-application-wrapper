export interface ReportKpiCard {
  id: string;
  title: string;
  queryIndex: number;
  valueColumn: string;
  format?: 'currency' | 'number' | 'percent' | 'text';
  prefix?: string;
  suffix?: string;
  subtitle?: string;
}

export interface ReportChartConfig {
  id: string;
  title: string;
  chartType: 'bar' | 'donut' | 'line';
  queryIndex: number;
  labelColumn: string;
  valueColumn: string;
  color?: string;
}

export interface ReportTableConfig {
  id: string;
  title: string;
  queryIndex: number;
  columns?: string[];
  showTotalRow?: boolean;
}

export interface ReportConfig {
  companyName: string;
  reportTitle: string;
  subtitle: string;
  preparedBy: string;
  periodText?: string;
  notes?: string;
  kpiCards: ReportKpiCard[];
  charts: ReportChartConfig[];
  tables: ReportTableConfig[];
}

export interface SavedReport {
  id: string;
  name: string;
  description: string;
  query_id: string; // references t_sql_queries or custom query
  custom_sql?: string;
  config: string; // JSON of ReportConfig
  created_at: string;
}
