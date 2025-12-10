import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { DEFAULT_TABLE } from './constants';
import { Settings, Layers, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [tableName, setTableName] = useState(DEFAULT_TABLE);
  const [inputTable, setInputTable] = useState(DEFAULT_TABLE);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTableName(inputTable);
    setIsConfigOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Supabase<span className="font-light">Vision</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700 text-xs text-slate-400">
                <Layers className="w-3 h-3" />
                <span>Table: <span className="text-indigo-400 font-mono">{tableName}</span></span>
              </div>
              
              <button 
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* Configuration Dropdown (Simple implementation) */}
        {isConfigOpen && (
          <div className="mb-8 p-6 bg-slate-800 border border-slate-700 rounded-xl animate-in slide-in-from-top-4 fade-in duration-200">
            <h2 className="text-lg font-semibold text-white mb-4">Dashboard Configuration</h2>
            <form onSubmit={handleTableSubmit} className="flex gap-4 items-end">
              <div className="flex-1 max-w-md">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Target Supabase Table
                </label>
                <input
                  type="text"
                  value={inputTable}
                  onChange={(e) => setInputTable(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g. orders, events, users"
                />
              </div>
              <button 
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
              >
                Update Dashboard
              </button>
            </form>
          </div>
        )}

        {/* Dashboard Content */}
        <Dashboard 
          tableName={tableName} 
          onTableChange={(newTable) => {
            setTableName(newTable);
            setInputTable(newTable);
          }}
        />
      </main>
    </div>
  );
};

export default App;