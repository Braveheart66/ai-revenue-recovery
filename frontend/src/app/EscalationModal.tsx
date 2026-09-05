import React, { useState, useEffect } from "react";
import { X, ShieldAlert, Building, Mail, Clock, CheckCircle, RefreshCw, UserCheck } from "lucide-react";

export interface EscalationTicket {
  id: string;
  invoiceId: string;
  orderId: string;
  amountPaise: number;
  customerName: string;
  customerPhone: string;
  reasoning: string;
  status: string;
  executedAt: string;
  assignedOfficer: {
    name: string;
    role: string;
    department: string;
    email: string;
    avatar: string;
    slaHours: string;
    recommendedAction: string;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export function EscalationModal({ isOpen, onClose, onResolved }: Props) {
  const [escalations, setEscalations] = useState<EscalationTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<EscalationTicket | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("http://localhost:8080/api/escalations")
      .then((res) => res.json())
      .then((data) => {
        setEscalations(data.escalations || []);
        if (data.escalations && data.escalations.length > 0) {
          setSelectedTicket(data.escalations[0]);
        }
      })
      .catch(console.error);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResolve = async () => {
    if (!selectedTicket) return;
    setIsResolving(true);
    try {
      const res = await fetch(`http://localhost:8080/api/escalations/${selectedTicket.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionNotes: resolutionNotes || "Mandate successfully renewed via human outreach call.",
          resolutionStatus: "SUCCESS",
        }),
      });
      if (res.ok) {
        setResolutionNotes("");
        onResolved();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsResolving(false);
    }
  };

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-rose-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>Merchant Operations Escalation Desk</span>
                <span className="text-xs bg-rose-950 border border-rose-700 text-rose-300 px-2 py-0.5 rounded font-mono">
                  Human in the Loop
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Assigned officers for non-retriable card expirations, mandate renewals, and fraud review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Ticket List on Left (5 Cols) */}
          <div className="md:col-span-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Active Escalation Queue ({escalations.length})
            </h3>
            {escalations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl font-mono text-xs">
                No open escalations right now. Queue is clear!
              </div>
            ) : (
              escalations.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedTicket?.id === ticket.id
                      ? "bg-rose-950/40 border-rose-500/80 text-rose-100 ring-1 ring-rose-500/40"
                      : "bg-gray-950/60 border-gray-800 hover:border-gray-700 text-gray-300"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold text-white font-mono">{ticket.orderId}</span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(ticket.executedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-rose-300 font-medium truncate mb-1">
                    Assigned: {ticket.assignedOfficer.name}
                  </p>
                  <div className="flex justify-between items-center text-[10px] text-gray-400">
                    <span>{formatINR(ticket.amountPaise)}</span>
                    <span className="bg-rose-900/60 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                      {ticket.assignedOfficer.slaHours}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Details & Action Panel on Right (7 Cols) */}
          <div className="md:col-span-7 bg-gray-950/80 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
            {selectedTicket ? (
              <div className="space-y-4">
                {/* Assigned Human Profile Card */}
                <div className="bg-gradient-to-r from-gray-900 to-rose-950/30 p-4 rounded-xl border border-rose-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center font-bold text-white shadow-lg text-sm">
                      {selectedTicket.assignedOfficer.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-base">{selectedTicket.assignedOfficer.name}</h4>
                        <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
                          ACTIVE OFFICER
                        </span>
                      </div>
                      <p className="text-xs text-rose-300">{selectedTicket.assignedOfficer.role}</p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3 h-3 text-gray-500" /> {selectedTicket.assignedOfficer.department}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-800/80 text-xs">
                    <div className="text-gray-400 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-500" /> {selectedTicket.assignedOfficer.email}
                    </div>
                    <div className="text-gray-400 flex items-center gap-1.5 justify-end font-mono">
                      <Clock className="w-3.5 h-3.5 text-amber-400" /> {selectedTicket.assignedOfficer.slaHours}
                    </div>
                  </div>
                </div>

                {/* Customer Target Info */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-900/60 p-3 rounded-lg border border-gray-800">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Customer Name:</span>
                    <span className="text-white font-medium">{selectedTicket.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Phone:</span>
                    <span className="text-indigo-400 font-mono">{selectedTicket.customerPhone}</span>
                  </div>
                </div>

                {/* AI Diagnosis Reason */}
                <div>
                  <span className="text-xs text-gray-400 font-semibold block mb-1">AI Diagnosis & Trigger:</span>
                  <p className="text-xs text-gray-300 italic bg-gray-900/90 p-2.5 rounded-lg border border-gray-800">
                    "{selectedTicket.reasoning}"
                  </p>
                </div>

                {/* Recommended Officer Action */}
                <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg text-xs text-amber-200">
                  <span className="font-bold block mb-0.5">💡 Prescribed Protocol:</span>
                  {selectedTicket.assignedOfficer.recommendedAction}
                </div>

                {/* Resolution Form */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                    Officer Resolution Log
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g. Contacted customer; renewed UPI auto-pay mandate or updated card on file."
                    rows={3}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none placeholder:text-gray-600"
                  />
                  <button
                    onClick={handleResolve}
                    disabled={isResolving}
                    className="w-full mt-3 bg-gradient-to-r from-rose-600 via-pink-600 to-emerald-600 hover:from-rose-500 hover:to-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating Ledger & Marking Resolved...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Mark Resolved by {selectedTicket.assignedOfficer.name.split(" ")[0]} (Close Ticket)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono">
                Select a ticket from the queue on the left to review assigned officer details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
