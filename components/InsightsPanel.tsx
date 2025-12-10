import React from 'react';
import { InsightData } from '../types';
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  insights: InsightData | null;
  loading: boolean;
  onRefresh: () => void;
}

export const InsightsPanel: React.FC<Props> = ({ insights, loading, onRefresh }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          AI Insights
        </h3>
        <button 
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Refresh Analysis'}
        </button>
      </div>

      {!insights && !loading && (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm italic">
          No insights available. Connect data to generate analysis.
        </div>
      )}

      {loading && !insights && (
         <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
            <div className="animate-pulse bg-slate-700 h-4 w-3/4 rounded"></div>
            <div className="animate-pulse bg-slate-700 h-4 w-1/2 rounded"></div>
         </div>
      )}

      {insights && (
        <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          <div>
            <h4 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-2 text-xs">Summary</h4>
            <p className="text-slate-300 text-sm leading-relaxed">
              {insights.summary}
            </p>
          </div>

          {insights.trends.length > 0 && (
            <div>
              <h4 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-2 text-xs flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Trends
              </h4>
              <ul className="space-y-2">
                {insights.trends.map((trend, i) => (
                  <li key={i} className="text-sm text-emerald-400 bg-emerald-400/10 p-2 rounded border border-emerald-400/20">
                    {trend}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.anomalies.length > 0 && (
            <div>
              <h4 className="text-sm uppercase tracking-wider text-slate-500 font-bold mb-2 text-xs flex items-center gap-1">
                 <AlertTriangle className="w-3 h-3" /> Anomalies
              </h4>
               <ul className="space-y-2">
                {insights.anomalies.map((anomaly, i) => (
                  <li key={i} className="text-sm text-amber-400 bg-amber-400/10 p-2 rounded border border-amber-400/20">
                    {anomaly}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
