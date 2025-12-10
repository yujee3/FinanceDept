import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, checkTableExists } from '../services/supabaseClient';
import { generateInsights } from '../services/geminiService';
import { DataRow, InsightData } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { 
  Activity, Database, RefreshCw, AlertCircle, 
  Table as TableIcon, DollarSign, TrendingUp, PieChart as PieIcon,
  Search
} from 'lucide-react';
import { Spinner } from './Spinner';
import { InsightsPanel } from './InsightsPanel';

// --- Helper Utilities ---

// Fuzzy match column names
const findKey = (row: DataRow, candidates: string[]): string | undefined => {
  const keys = Object.keys(row).map(k => k.toLowerCase());
  const found = candidates.find(c => keys.some(k => k.includes(c)));
  if (!found) return undefined;
  // Return actual case-sensitive key
  return Object.keys(row).find(k => k.toLowerCase().includes(found));
};

// Colors for charts
const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#a855f7', '#ef4444'];

interface Props {
  tableName: string;
  onTableChange: (newTable: string) => void;
}

export const Dashboard: React.FC<Props> = ({ tableName, onTableChange }) => {
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableExists, setTableExists] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [newTableInput, setNewTableInput] = useState('');

  // --- Data Fetching ---

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRealtimeStatus('disconnected');
    
    try {
      const exists = await checkTableExists(tableName);
      if (!exists) {
        setTableExists(false);
        throw new Error(`Table "${tableName}" was not found or is not accessible.`);
      }

      setTableExists(true);

      const { data: rows, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1000); // Increased limit for better analytics

      if (fetchError) throw fetchError;

      // Sort by date if possible
      const dateK = rows && rows.length > 0 ? findKey(rows[0], ['created_at', 'date', 'time']) : null;
      const sortedRows = rows ? [...rows].sort((a, b) => {
        if (!dateK) return 0;
        return new Date(a[dateK]).getTime() - new Date(b[dateK]).getTime();
      }) : [];

      setData(sortedRows);
    } catch (err: any) {
      console.warn("Dashboard Error:", err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!tableExists || loading || error) return;
    setRealtimeStatus('connecting');
    const channel = supabase
      .channel(`public:${tableName}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tableName }, (payload) => {
          setData(prev => [...prev, payload.new].slice(-1000));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else setRealtimeStatus('disconnected');
      });
    return () => { supabase.removeChannel(channel); };
  }, [tableName, tableExists, loading, error]);

  // AI Insights
  const triggerAnalysis = useCallback(async () => {
    if (data.length === 0) return;
    setAnalyzing(true);
    const result = await generateInsights(tableName, data);
    setInsights(result);
    setAnalyzing(false);
  }, [data, tableName]);

  useEffect(() => {
    if (data.length > 0 && !insights && !analyzing) {
      triggerAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  const handleTableUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTableInput) {
      onTableChange(newTableInput);
      setNewTableInput('');
    }
  };

  // --- Aggregation Logic ---

  const analytics = useMemo(() => {
    if (data.length === 0) return null;

    const sample = data[0];
    
    // Attempt to identify semantic columns
    const deptKey = findKey(sample, ['department', 'category', 'dept', 'group']) || 'department';
    const revKey = findKey(sample, ['revenue', 'sales', 'amount', 'total', 'price']) || 'revenue';
    const expKey = findKey(sample, ['expense', 'cost', 'spending']) || 'expenses';
    const profitKey = findKey(sample, ['profit', 'net', 'margin']) || 'profit'; // Will derive if missing
    const dateKey = findKey(sample, ['created_at', 'date', 'time']) || 'created_at';
    const idKey = findKey(sample, ['id', 'order', 'name']) || 'id';

    // 1. Monthly Revenue & Profit
    // We store a sortKey (YYYYMM) to ensure chronological sorting
    const monthlyData: Record<string, { month: string, revenue: number, profit: number, sortKey: number }> = {};
    
    // 2. Department aggregation
    const deptStats: Record<string, { name: string, revenue: number, expenses: number, profit: number }> = {};

    data.forEach(row => {
      const rev = Number(row[revKey]) || 0;
      const exp = Number(row[expKey]) || 0;
      // Derive profit if column doesn't exist
      const profit = row[profitKey] !== undefined ? Number(row[profitKey]) : (rev - exp);

      // Monthly
      let month = 'Unknown';
      let sortKey = 0;
      try {
        const d = new Date(row[dateKey]);
        if (!isNaN(d.getTime())) {
          month = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          sortKey = d.getFullYear() * 100 + d.getMonth();
        }
      } catch (e) {}

      if (!monthlyData[month]) monthlyData[month] = { month, revenue: 0, profit: 0, sortKey };
      monthlyData[month].revenue += rev;
      monthlyData[month].profit += profit;

      // Department
      const dept = String(row[deptKey] || 'Unassigned');
      if (!deptStats[dept]) deptStats[dept] = { name: dept, revenue: 0, expenses: 0, profit: 0 };
      deptStats[dept].revenue += rev;
      deptStats[dept].expenses += exp;
      deptStats[dept].profit += profit;
    });

    // Transform to arrays for charts and sort chronologically
    const monthlyChartData = Object.values(monthlyData).sort((a, b) => a.sortKey - b.sortKey);
    
    // Assign stable colors to departments based on alphabetical order
    // This ensures that "Marketing" has the same color across all charts
    const deptChartData = Object.values(deptStats)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d, index) => ({
        ...d,
        margin: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0,
        fill: COLORS[index % COLORS.length] // Stable color assignment
      }));

    // Top 5 Expenses
    // We sort by expenses, but the 'fill' property remains attached to the department
    const expensesByDept = [...deptChartData].sort((a,b) => b.expenses - a.expenses).slice(0, 5);

    // Top 10 Profitable Orders
    const topOrders = [...data]
      .map(row => {
        const rev = Number(row[revKey]) || 0;
        const exp = Number(row[expKey]) || 0;
        const profit = row[profitKey] !== undefined ? Number(row[profitKey]) : (rev - exp);
        return { ...row, _derivedProfit: profit };
      })
      .sort((a, b) => b._derivedProfit - a._derivedProfit)
      .slice(0, 10);

    return {
      monthlyChartData,
      deptChartData,
      expensesByDept,
      topOrders,
      keys: { deptKey, revKey, expKey, profitKey, idKey, dateKey }
    };

  }, [data]);

  // --- Rendering ---

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-10 h-10 text-indigo-500" /></div>;
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-800/50 rounded-xl border border-slate-700 p-8">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Connection Issue</h3>
        <p className="text-slate-400 mb-6 text-center">{error}</p>
        <form onSubmit={handleTableUpdate} className="flex gap-2 w-full max-w-sm">
            <input 
              type="text" 
              placeholder="Try another table (e.g. orders)"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white outline-none"
              value={newTableInput}
              onChange={(e) => setNewTableInput(e.target.value)}
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg">Connect</button>
        </form>
      </div>
    );
  }

  if (!data.length || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Database className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400">No data available in {tableName}.</p>
      </div>
    );
  }

  const { monthlyChartData, deptChartData, expensesByDept, topOrders, keys } = analytics;

  return (
    <div className="space-y-6">
      
      {/* Realtime Status Bar */}
      <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            realtimeStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            <span className={`h-2 w-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
            {realtimeStatus === 'connected' ? 'Live Updates' : 'Connecting...'}
          </div>
          <span className="text-slate-400 text-sm">Analyzing <span className="text-white font-mono">{data.length}</span> records</span>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ROW 1: Monthly Revenue & Profit (Big Chart) */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Monthly Revenue & Profit
            </h3>
            <p className="text-sm text-slate-400">Financial performance over time</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyChartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 1: AI Insights Panel */}
        <div className="lg:col-span-1">
           <InsightsPanel insights={insights} loading={analyzing} onRefresh={triggerAnalysis} />
        </div>

        {/* ROW 2: Dept Revenue & Dept Expenses */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
           <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Total Revenue by Department
           </h3>
           <div className="h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={deptChartData}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                 <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                 <YAxis stroke="#94a3b8" fontSize={12} />
                 <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} cursor={{fill: '#334155', opacity: 0.2}} />
                 <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {deptChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl flex flex-col">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
             <PieIcon className="w-5 h-5 text-rose-400" />
             Expenses by Dept (Top 5)
          </h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expensesByDept}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="expenses"
                >
                  {expensesByDept.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 3: Avg Margin & Top Orders */}
        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
           <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Avg Profit Margin %
           </h3>
           <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={deptChartData} layout="vertical">
                 <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                 <XAxis type="number" stroke="#94a3b8" fontSize={12} unit="%" />
                 <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={80} />
                 <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} formatter={(val: number) => val.toFixed(1) + '%'} />
                 <Bar dataKey="margin" radius={[0, 4, 4, 0]} barSize={20}>
                    {deptChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-indigo-400" />
              Top 10 Most Profitable Orders
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400">
              <thead className="bg-slate-900/50 text-slate-200 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Dept</th>
                  <th className="px-6 py-3 text-right">Revenue</th>
                  <th className="px-6 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {topOrders.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-white">{row[keys.idKey]}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const rawDate = row[keys.dateKey];
                        if (!rawDate) return 'N/A';
                        const d = new Date(rawDate);
                        return isNaN(d.getTime()) ? String(rawDate) : d.toLocaleDateString();
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                        {row[keys.deptKey] || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-medium">
                      ${Number(row[keys.revKey]).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-amber-400 font-medium">
                      ${row._derivedProfit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};