import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function CreatorSupportSheet({ profile, onClose }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(
    profile?.subscriptionPrice ? "subscribe" : profile?.paidDmPrice ? "dm" : "tip"
  );
  const [amount, setAmount] = useState(String(profile?.tipMinCoins ?? 10));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshWallet = () => {
    queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
    queryClient.invalidateQueries({ queryKey: ["public-profile", profile.username] });
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await dataProvider.subscribeToCreator(profile.id);
      refreshWallet();
      toast({ title: "Subscribed!", description: "You now have access to subscriber-only content for 30 days." });
      onClose();
    } catch (err) {
      toast({ title: "Subscribe failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTip = async (tipType = "tip") => {
    const parsed =
      tipType === "paid_dm"
        ? profile.paidDmPrice
        : parseInt(amount, 10);
    if (!parsed || parsed <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await dataProvider.sendCreatorTip({
        receiverId: profile.id,
        amount: parsed,
        message,
        tipType,
      });
      refreshWallet();
      toast({
        title: tipType === "paid_dm" ? "Paid message sent" : "Tip sent",
        description: `Creator receives ${result.receiver_amount ?? Math.floor(parsed * 0.8)} gift coins`,
      });
      onClose();
      if (result.conversation_id) {
        navigate(`/chat/${result.conversation_id}`);
      }
    } catch (err) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    profile?.subscriptionPrice ? { id: "subscribe", label: "Subscribe" } : null,
    { id: "tip", label: "Tip" },
    profile?.paidDmPrice ? { id: "dm", label: "Paid DM" } : null,
  ].filter(Boolean);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="fixed bottom-0 left-0 right-0 z-[301] bg-[#101822] rounded-t-3xl border-t border-white/10 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl max-h-[85dvh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-1">Support @{profile.username}</h3>
        <p className="text-xs text-slate-400 mb-4">Uses platform coins · Creators receive 80% as gift coins</p>

        {tabs.length > 1 && (
          <div className="flex gap-2 mb-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                  tab === t.id ? "bg-[#3b82f6] text-white" : "bg-white/5 text-slate-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === "subscribe" && profile.subscriptionPrice ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-violet-500/10 border border-violet-500/30 p-4">
              <p className="text-2xl font-black text-white">{profile.subscriptionPrice} coins / month</p>
              <p className="text-sm text-slate-300 mt-2">
                {profile.subscriptionDescription || "Access subscriber-only posts and support this creator."}
              </p>
              {profile.isSubscribed ? (
                <p className="text-emerald-400 text-sm font-semibold mt-3">You&apos;re subscribed</p>
              ) : (
                <PrimaryButton onClick={handleSubscribe} disabled={loading} className="w-full mt-4 rounded-xl">
                  {loading ? "Processing..." : "Subscribe for 30 days"}
                </PrimaryButton>
              )}
            </div>
          </div>
        ) : null}

        {tab === "tip" ? (
          <div className="space-y-3">
            <input
              type="number"
              min={profile.tipMinCoins ?? 10}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl bg-[#0d1420] border border-white/10 px-4 py-3 text-white"
              placeholder={`Min ${profile.tipMinCoins ?? 10} coins`}
            />
            <PrimaryButton onClick={() => handleTip("tip")} disabled={loading} className="w-full rounded-xl">
              {loading ? "Sending..." : "Send tip"}
            </PrimaryButton>
          </div>
        ) : null}

        {tab === "dm" && profile.paidDmPrice ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Minimum {profile.paidDmPrice} coins for a highlighted DM</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              rows={3}
              className="w-full rounded-xl bg-[#0d1420] border border-white/10 px-4 py-3 text-white resize-none"
            />
            <PrimaryButton
              onClick={() => handleTip("paid_dm")}
              disabled={loading}
              className="w-full rounded-xl"
            >
              {loading ? "Sending..." : `Send paid DM (${profile.paidDmPrice}+ coins)`}
            </PrimaryButton>
          </div>
        ) : null}
      </motion.div>
    </>
  );
}
