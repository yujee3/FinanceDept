export interface DataRow {
  [key: string]: any;
}

export interface ChartConfig {
  xAxisKey: string;
  dataKeys: string[];
}

export interface InsightData {
  summary: string;
  trends: string[];
  anomalies: string[];
}
