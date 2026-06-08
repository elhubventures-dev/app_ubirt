import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function AdminModeration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [note, setNote] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: isAdmin, isLoading: isCheckingAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => dataProvider.getIsAdmin(),
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["moderation-queue", tab],
    queryFn: () => dataProvider.getModerationQueue(tab),
    enabled: Boolean(isAdmin),
  });

  const handleReview = async (reportId, status) => {
    setIsSubmitting(true);
    try {
      await dataProvider.reviewReport(reportId, {
        status,
        resolutionNote: note.trim() || null,
        actionTaken: status === "dismissed" ? "dismissed" : "none",
      });
      toast({ title: status === "dismissed" ? "Report dismissed" : "Report reviewed" });
      setSelectedId(null);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["moderation-queue"] });
    } catch (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAdmin) {
    return <div className="p-8 text-slate-400">Checking access...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#101822] text-white flex flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-[48px] text-slate-500 mb-4">shield</span>
        <h1 className="text-xl font-bold mb-2">Admin access required</h1>
        <p className="text-sm text-slate-400 mb-6">This page is for moderation staff only.</p>
        <Link to="/" className="text-[#3b82f6] font-semibold hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101822] text-white pb-24 px-4 pt-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Moderation queue</h1>
          <p className="text-sm text-slate-400 mt-1">Review user reports and take action.</p>
        </div>
        <Link to="/settings" className="text-sm text-[#3b82f6] font-semibold">
          Settings
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {["pending", "reviewed", "dismissed"].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setTab(status)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize ${
              tab === status ? "bg-[#3b82f6] text-white" : "bg-white/5 text-slate-400"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-slate-400">Loading reports...</p>
      ) : !reports.length ? (
        <p className="text-slate-400">No {tab} reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize">{report.targetType} report</p>
                  <p className="text-xs text-slate-400 mt-1">
                    By @{report.reporterUsername || report.reporterName} · {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 shrink-0">{report.targetId.slice(0, 8)}…</span>
              </div>
              <p className="text-sm text-slate-200 mt-3">{report.reason}</p>
              {report.details ? <p className="text-xs text-slate-400 mt-2">{report.details}</p> : null}
              {report.resolutionNote ? (
                <p className="text-xs text-emerald-400 mt-2">Note: {report.resolutionNote}</p>
              ) : null}

              {tab === "pending" ? (
                <div className="mt-4 space-y-3">
                  {selectedId === report.id ? (
                    <>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Internal resolution note (optional)"
                        rows={2}
                        className="w-full rounded-xl bg-[#0a0f16] border border-white/10 px-3 py-2 text-sm text-white resize-none"
                      />
                      <div className="flex gap-2">
                        <PrimaryButton
                          className="flex-1 rounded-xl py-2 text-sm"
                          disabled={isSubmitting}
                          onClick={() => handleReview(report.id, "reviewed")}
                        >
                          Mark reviewed
                        </PrimaryButton>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleReview(report.id, "dismissed")}
                          className="flex-1 py-2 rounded-xl bg-white/10 text-sm font-semibold"
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(report.id);
                        setNote("");
                      }}
                      className="text-sm font-semibold text-[#3b82f6]"
                    >
                      Review
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
