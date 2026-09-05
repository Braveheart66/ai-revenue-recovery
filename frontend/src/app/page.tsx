"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Zap,
  CreditCard,
  Phone,
  Sparkles,
  UserCheck,
  Flame,
} from "lucide-react";

interface MetricsData {
  total_at_risk_paise: number;
  total_recovered_paise: number;
  recovery_rate_percentage: number;
  total_invoices_processed: number;
  breakdown_by_strategy: {
    SILENT_RETRY?: number;
    WHATSAPP_NEGOTIATION?: number;
    VOICE_CALL?: number;
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

interface ToastMessage {
  id: number;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description: string;
}

const ERROR_OPTIONS = [
  {
    label: "Insufficient Balance (Triggers WhatsApp)",
    code: "BAD_REQUEST_ERROR",
    description: "Payment failed due to insufficient funds in customer bank account",
    hint: "AI chooses WhatsApp negotiation with dynamic discount payment link.",
  },
  {
    label: "Gateway Timeout (Triggers Silent Retry)",
    code: "GATEWAY_ERROR",
    description: "Bank gateway timed out during OTP authorization step",
    hint: "AI schedules automatic background silent retry with jitter.",
  },
  {
    label: "Card Expired (Triggers Direct Human Escalation)",
    code: "CARD_EXPIRED_ERROR",
    description: "Card validity expired or transaction unauthorized by issuer",
    hint: "AI recognizes expired payment instrument. Bypasses bot retries and immediately dispatches Human Escalation Protocol.",
  },
];

function DashboardComponent() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);

  // Simulation State
  const [selectedErrorIndex, setSelectedErrorIndex] = useState(0);
  const [amountPaise, setAmountPaise] = useState(50000); // 50000 paise = ₹500
  const [userPhone, setUserPhone] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "success" | "error" | "info" | "warning", title: string, description: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleInjectFailure = async () => {
    setIsInjecting(true);
    const selected = ERROR_OPTIONS[selectedErrorIndex];

    try {
      const res = await fetch("http://localhost:8080/api/simulate/failure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_code: selected.code,
          error_description: selected.description,
          amount_paise: Number(amountPaise) || 50000,
          user_phone: userPhone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActiveOrderId(data.order_id);
        const contactDisplay = data.contact ? ` to ${data.contact}` : "";
        
        if (selected.code === "CARD_EXPIRED_ERROR") {
          addToast(
            "warning",
            "🚨 ESCALATED TO HUMAN DESK",
            `Card Expired detected. Bypassed auto-retry and escalated order ${data.order_id} to merchant operations.`
          );
        } else {
          addToast(
            "success",
            "⚡ Failure Webhook Injected",
            `Order ${data.order_id} generated${contactDisplay}. AI Router triggered autonomously.`
          );
        }
        fetchMetrics();
      } else {
        addToast("error", "Injection Failed", data.error || "Server returned an error");
      }
    } catch (err: any) {
      addToast("error", "Network Error", err.message || "Failed to reach backend simulation endpoint");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!activeOrderId) return;
    setIsSettling(true);

    try {
      const res = await fetch("http://localhost:8080/api/simulate/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: activeOrderId,
          amount_paise: Number(amountPaise) || 50000,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast(
          "success",
          "💸 Recovery Succeeded!",
          `Customer paid order ${activeOrderId}. Loop closed and revenue recovered!`
        );
        fetchMetrics();
      } else {
        addToast("error", "Payment Failed", data.error || "Simulation failed");
      }
    } catch (err: any) {
      addToast("error", "Network Error", err.message || "Could not reach simulation endpoint");
    } finally {
      setIsSettling(false);
    }
  };

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
  };

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
    VOICE_CALL: <Activity className="w-5 h-5 text-amber-400" />,
    ESCALATE_TO_HUMAN: <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />,
  };

  if (!metrics) {
    return (
      <main
        className="min-h-screen bg-gray-950 text-white font-mono p-10 flex items-center justify-center"
        suppressHydrationWarning
      >
        <div className="flex items-center gap-3" suppressHydrationWarning>
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
          <span>Booting AI Recovery Engine...</span>
        </div>
      </main>
    );
  }

  const escalationCount = metrics.breakdown_by_strategy.ESCALATE_TO_HUMAN || 0;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans relative" suppressHydrationWarning>
      {/* Toast Notification Stack */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-top-4 ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-100"
                : toast.type === "warning"
                ? "bg-rose-950/90 border-rose-500/60 text-rose-100 ring-2 ring-rose-500/40"
                : toast.type === "error"
                ? "bg-red-950/90 border-red-500/50 text-red-100"
                : "bg-blue-950/90 border-blue-500/50 text-blue-100"
            }`}
          >
            <p className="font-bold text-sm flex items-center gap-2">
              {toast.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {toast.type === "warning" && <ShieldAlert className="w-4 h-4 text-rose-400" />}
              {toast.type === "error" && <AlertTriangle className="w-4 h-4 text-red-400" />}
              {toast.title}
            </p>
            <p className="text-xs mt-1 text-gray-300 break-words">{toast.description}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-gray-800 pb-6 gap-4" suppressHydrationWarning>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
              Autonomous Revenue Recovery
            </h1>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Track 03 Ready
            </span>
          </div>
          <p className="text-gray-400 mt-2 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" /> Live Telemetry, Autonomous Mediation & Human Escalation Desk
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Invoices Evaluated</p>
          <p className="text-2xl font-mono text-white font-semibold">{metrics.total_invoices_processed}</p>
        </div>
      </header>

      {/* Top Metrics Cards - 4 Columns including Escalation Desk */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" suppressHydrationWarning>
        <div className="bg-gray-900/90 border border-gray-800 p-6 rounded-2xl shadow-lg backdrop-blur" suppressHydrationWarning>
          <h3 className="text-gray-400 text-sm font-medium mb-1">Revenue At Risk</h3>
          <p className="text-3xl font-bold text-red-400 font-mono tracking-tight">
            {formatINR(metrics.total_at_risk_paise)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Aggregated failed payment volume</p>
        </div>
        <div className="bg-gray-900/90 border border-gray-800 p-6 rounded-2xl shadow-lg backdrop-blur" suppressHydrationWarning>
          <h3 className="text-gray-400 text-sm font-medium mb-1">Revenue Recovered</h3>
          <p className="text-3xl font-bold text-emerald-400 font-mono tracking-tight">
            {formatINR(metrics.total_recovered_paise)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Recovered via autonomous interventions</p>
        </div>
        <div className="bg-gray-900/90 border border-gray-800 p-6 rounded-2xl shadow-lg relative overflow-hidden backdrop-blur" suppressHydrationWarning>
          <h3 className="text-gray-400 text-sm font-medium mb-1">AI Recovery Rate</h3>
          <p className="text-3xl font-bold text-blue-400 font-mono tracking-tight">
            {metrics.recovery_rate_percentage.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-2">Closed loop conversion efficacy</p>
          <div className="absolute right-[-10%] top-[-10%] opacity-10">
            <CheckCircle className="w-24 h-24 text-blue-400" />
          </div>
        </div>

        {/* Dedicated Human Escalation Desk Card */}
        <div className={`p-6 rounded-2xl shadow-lg relative overflow-hidden backdrop-blur border transition-all ${
          escalationCount > 0 
            ? "bg-rose-950/30 border-rose-500/40 ring-1 ring-rose-500/30" 
            : "bg-gray-900/90 border-gray-800"
        }`} suppressHydrationWarning>
          <div className="flex justify-between items-start">
            <h3 className="text-gray-400 text-sm font-medium mb-1">Human Escalations</h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
              escalationCount > 0 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-gray-800 text-gray-500"
            }`}>
              {escalationCount > 0 ? "Active Queue" : "Clear"}
            </span>
          </div>
          <p className={`text-3xl font-bold font-mono tracking-tight ${escalationCount > 0 ? "text-rose-400" : "text-gray-300"}`}>
            {escalationCount}
          </p>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Non-retriable & Expired instruments
          </p>
        </div>
      </div>

      {/* Main Grid: Control Center + Intervention Stats + Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" suppressHydrationWarning>
        
        {/* Left Col: Interactive Live Control Center (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6" suppressHydrationWarning>
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden" suppressHydrationWarning>
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Live Control Center</h2>
                  <p className="text-xs text-gray-400">Inject Razorpay webhooks to demo</p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/40">
                Simulator
              </span>
            </div>

            {/* Error Injection Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Error Injection Type
                </label>
                <select
                  value={selectedErrorIndex}
                  onChange={(e) => setSelectedErrorIndex(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
                >
                  {ERROR_OPTIONS.map((opt, i) => (
                    <option key={opt.code} value={i}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className={`mt-2 p-2.5 rounded-xl border text-xs leading-relaxed ${
                  ERROR_OPTIONS[selectedErrorIndex].code === "CARD_EXPIRED_ERROR"
                    ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                    : "bg-indigo-950/30 border-indigo-500/30 text-indigo-200"
                }`}>
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    {ERROR_OPTIONS[selectedErrorIndex].code === "CARD_EXPIRED_ERROR" ? (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>High-Priority Escalation Scenario</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Autonomous Recovery Scenario</span>
                      </>
                    )}
                  </p>
                  {ERROR_OPTIONS[selectedErrorIndex].hint}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Customer Phone Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+919555268266 (Twilio Sandbox / WhatsApp)"
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-600"
                  />
                  <Phone className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Optional. If empty, defaults to mock test number <code>+919999999999</code>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Transaction Amount (Paise)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountPaise}
                    onChange={(e) => setAmountPaise(Number(e.target.value))}
                    step="1000"
                    min="1000"
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-gray-400 font-mono">
                    = {formatINR(amountPaise)}
                  </span>
                </div>
              </div>

              {/* Inject Button */}
              <button
                onClick={handleInjectFailure}
                disabled={isInjecting}
                className={`w-full mt-2 font-semibold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  ERROR_OPTIONS[selectedErrorIndex].code === "CARD_EXPIRED_ERROR"
                    ? "bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white"
                    : "bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white"
                }`}
              >
                {isInjecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Webhook & AI Diagnosis...</span>
                  </>
                ) : ERROR_OPTIONS[selectedErrorIndex].code === "CARD_EXPIRED_ERROR" ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-white" />
                    <span>🚨 Inject Card Expired & Trigger Escalation</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                    <span>⚡ Inject Failure Webhook</span>
                  </>
                )}
              </button>
            </div>

            {/* Active Order Card */}
            <div className="mt-6 pt-5 border-t border-gray-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Active Simulation Target
                </span>
                {activeOrderId ? (
                  <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
                    ORDER RECORDED
                  </span>
                ) : (
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                    AWAITING INJECTION
                  </span>
                )}
              </div>

              <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 font-mono text-xs break-all">
                {activeOrderId ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 text-[10px]">CURRENT ORDER ID:</span>
                    <span className="text-indigo-400 font-bold">{activeOrderId}</span>
                  </div>
                ) : (
                  <span className="text-gray-500 italic">Click "Inject Failure Webhook" above to generate a mock order.</span>
                )}
              </div>
            </div>

            {/* Customer Action Step */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Customer Action (Close The Loop)
              </label>
              <button
                onClick={handleSimulatePayment}
                disabled={!activeOrderId || isSettling}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed cursor-pointer"
              >
                {isSettling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Settling Link & Updating DB...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-emerald-200" />
                    <span>💸 Simulate Customer Paying Link</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                Sends signed <code className="text-emerald-400">payment_link.paid</code> webhook to settle the invoice and prove 100% closed-loop autonomous recovery.
              </p>
            </div>
          </div>

          {/* Intervention Strategy Summary Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg" suppressHydrationWarning>
            <h2 className="text-base font-semibold mb-5 border-b border-gray-800 pb-3 flex items-center justify-between">
              <span>Strategy Breakdown</span>
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </h2>
            <div className="space-y-4">
              {Object.entries(metrics.breakdown_by_strategy).map(([strategy, count]) => {
                const isEscalation = strategy === "ESCALATE_TO_HUMAN";
                return (
                  <div
                    key={strategy}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isEscalation && count > 0
                        ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
                        : "bg-gray-950/60 border-gray-800/80 text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {strategyIcons[strategy] || <AlertTriangle className="w-5 h-5 text-gray-400" />}
                      <span className="text-xs font-semibold">{strategy.replace(/_/g, " ")}</span>
                    </div>
                    <span className={`font-mono text-base font-bold ${isEscalation && count > 0 ? "text-rose-400" : "text-white"}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: AI Decision Audit Trail & Escalation Queue (8 Cols) */}
        <div className="lg:col-span-8 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col" suppressHydrationWarning>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-800 pb-4 mb-6 gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>AI Decision Audit Log & Escalations</span>
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time chronological timeline of Gemini reasoning, autonomous outreach, and human escalations
              </p>
            </div>
            <div className="flex items-center gap-2">
              {escalationCount > 0 && (
                <span className="text-xs bg-rose-950 border border-rose-700/60 text-rose-400 px-3 py-1 rounded-full font-mono flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> {escalationCount} Escalated
                </span>
              )}
              <span className="text-xs bg-gray-800 border border-gray-700 px-3 py-1 rounded-full text-gray-300 font-mono">
                Auto-polled 2s
              </span>
            </div>
          </div>

          <div className="space-y-4 max-h-[680px] overflow-y-auto pr-2 custom-scrollbar">
            {metrics.recent_audit_trail.length === 0 ? (
              <div className="text-center py-16 text-gray-500 font-mono text-sm">
                No recovery logs detected yet. Use the Control Center to inject your first test failure!
              </div>
            ) : (
              metrics.recent_audit_trail.map((log) => {
                const isEscalation = log.strategy_chosen === "ESCALATE_TO_HUMAN";
                return (
                  <div
                    key={log.id}
                    className={`rounded-xl p-4 flex flex-col gap-2.5 transition-all shadow-sm border ${
                      isEscalation
                        ? "bg-rose-950/20 border-rose-500/50 hover:border-rose-400 ring-1 ring-rose-500/20"
                        : "bg-gray-950 border-gray-800/90 hover:border-gray-700"
                    }`}
                    suppressHydrationWarning
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md border ${
                          isEscalation ? "bg-rose-950 border-rose-800 text-rose-400" : "bg-gray-900 border-gray-800"
                        }`}>
                          {strategyIcons[log.strategy_chosen] || <AlertTriangle className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase tracking-wider ${
                              isEscalation ? "text-rose-400" : "text-gray-200"
                            }`}>
                              {log.strategy_chosen.replace(/_/g, " ")}
                            </span>
                            {isEscalation && (
                              <span className="text-[10px] bg-rose-900/60 border border-rose-700 text-rose-200 px-2 py-0.5 rounded font-mono font-semibold">
                                MANUAL INTERVENTION REQUIRED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                            Target Invoice: {log.invoice_id}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTime(log.executed_at)}
                      </span>
                    </div>

                    <p className={`text-xs leading-relaxed italic border-l-2 pl-3 py-1.5 rounded-r ${
                      isEscalation
                        ? "border-rose-500 bg-rose-950/40 text-rose-100"
                        : "border-indigo-500/60 bg-gray-900/40 text-gray-300"
                    }`}>
                      "{log.ai_reasoning}"
                    </p>

                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-900 text-xs">
                      <span className="text-[11px] text-gray-500 font-mono">
                        Log ID: {log.id.slice(0, 16)}...
                      </span>
                      <span
                        className={`text-[10px] uppercase px-2.5 py-0.5 rounded font-bold font-mono tracking-wider ${
                          isEscalation
                            ? "bg-rose-900/80 text-rose-200 border border-rose-700"
                            : log.status === "SUCCESS"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                            : log.status === "SCHEDULED"
                            ? "bg-blue-950/80 text-blue-400 border border-blue-800/50"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {isEscalation ? "ESCALATED" : log.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </main>
  );
}

// Disable SSR for this telemetry component so browser extensions cannot cause hydration mismatch
const Dashboard = dynamic(() => Promise.resolve(DashboardComponent), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-gray-950 text-white font-mono p-10 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        <span>Booting AI Recovery Engine...</span>
      </div>
    </main>
  ),
});

export default Dashboard;
