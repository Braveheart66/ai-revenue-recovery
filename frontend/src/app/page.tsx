"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, AlertTriangle, MessageCircle, RefreshCw, ShieldAlert } from "lucide-react";

interface MetricsData {
  total_at_risk_paise: number;
  total_recovered_paise: number;
  recovery_rate_percentage: number;
  total_invoices_processed: number;
  breakdown_by_strategy: {
    SILENT_RETRY?: number;
    WHATSAPP_NEGOTIATION?: number;
    ESCALATE_TO_HUMAN?: number;
  };
  recent_audit_trail: Array<{
    id: string;
    invoice_id: string;
    strategy_chosen: string;
    ai_reasoning: string;
    status: string;
    executed_at: string;
  }>;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchMetrics = async () => {
      try {
        const res = await fetch("http://localhost:8080/api/metrics");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted || !metrics) {
    return (
      <div className="min-h-screen bg-gray-950 text-white font-mono p-10 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          <span>Booting AI Recovery Engine...</span>
        </div>
      </div>
    );
  }

  const formatINR = (paise: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

  const formatTime = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString();
    } catch {
      return dateString;
    }
  };

  const strategyIcons: Record<string, any> = {
    SILENT_RETRY: <RefreshCw className="w-5 h-5 text-blue-400" />,
    WHATSAPP_NEGOTIATION: <MessageCircle className="w-5 h-5 text-green-400" />,
    ESCALATE_TO_HUMAN: <ShieldAlert className="w-5 h-5 text-red-400" />
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <header className="mb-10 flex justify-between items-end border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Autonomous Revenue Recovery
          </h1>
          <p className="text-gray-400 mt-2 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" /> Live System Telemetry
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Invoices Processed</p>
          <p className="text-2xl font-mono">{metrics.total_invoices_processed}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium mb-1">Revenue At Risk</h3>
          <p className="text-4xl font-bold text-red-400 font-mono tracking-tight">
            {formatINR(metrics.total_at_risk_paise)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-gray-400 text-sm font-medium mb-1">Revenue Recovered</h3>
          <p className="text-4xl font-bold text-emerald-400 font-mono tracking-tight">
            {formatINR(metrics.total_recovered_paise)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg relative overflow-hidden">
          <h3 className="text-gray-400 text-sm font-medium mb-1">AI Recovery Rate</h3>
          <p className="text-4xl font-bold text-blue-400 font-mono tracking-tight">
            {metrics.recovery_rate_percentage.toFixed(1)}%
          </p>
          <div className="absolute right-[-10%] top-[-10%] opacity-10">
            <CheckCircle className="w-32 h-32 text-blue-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 h-fit">
          <h2 className="text-lg font-semibold mb-6 border-b border-gray-800 pb-3">Intervention Strategies</h2>
          <div className="space-y-6">
            {Object.entries(metrics.breakdown_by_strategy).map(([strategy, count]) => (
              <div key={strategy} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {strategyIcons[strategy] || <AlertTriangle className="w-5 h-5" />}
                  <span className="text-sm font-medium text-gray-300">{strategy.replace(/_/g, ' ')}</span>
                </div>
                <span className="font-mono text-lg">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-6 border-b border-gray-800 pb-3 flex justify-between">
            <span>AI Decision Audit Log</span>
            <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">Strictly Bounded</span>
          </h2>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {metrics.recent_audit_trail.map((log) => (
              <div key={log.id} className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex flex-col gap-2 transition-all hover:border-gray-700">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {strategyIcons[log.strategy_chosen]}
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300">{log.strategy_chosen}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTime(log.executed_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 italic border-l-2 border-gray-700 pl-3 py-1">
                  "{log.ai_reasoning}"
                </p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-900">
                  <span className="text-xs text-gray-500 font-mono">INV: {log.invoice_id.split('_').pop()}</span>
                  <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${
                    log.status === 'SUCCESS' ? 'bg-emerald-900/30 text-emerald-400' : 
                    log.status === 'SCHEDULED' ? 'bg-blue-900/30 text-blue-400' : 
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
