import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/use-toast";

export default function MonetizationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["creator-monetization"],
    queryFn: () => dataProvider.getCreatorMonetizationSettings(),
  });

  const [form, setForm] = useState(null);
  const values = form ?? {
    subscriptionPrice: settings?.subscriptionPrice ?? "",
    subscriptionDescription: settings?.subscriptionDescription ?? "",
    tipMinCoins: settings?.tipMinCoins ?? 10,
    paidDmPrice: settings?.paidDmPrice ?? "",
  };

  const update = (key, val) => setForm({ ...values, [key]: val });

  const save = async () => {
    setSaving(true);
    try {
      await dataProvider.updateCreatorMonetization({
        subscriptionPrice: values.subscriptionPrice ? parseInt(values.subscriptionPrice, 10) : null,
        subscriptionDescription: values.subscriptionDescription,
        tipMinCoins: parseInt(values.tipMinCoins, 10) || 10,
        paidDmPrice: values.paidDmPrice ? parseInt(values.paidDmPrice, 10) : null,
      });
      queryClient.invalidateQueries({ queryKey: ["creator-monetization"] });
      setForm(null);
      toast({ title: "Monetization settings saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm space-y-3">
      <div>
        <h2 className="text-base font-bold">Monetization</h2>
        <p className="text-xs text-slate-400 mt-0.5">Subscriptions, tips, and paid DMs</p>
      </div>
      <label className="block text-xs text-slate-400">Subscription price (coins/mo, min 50 or empty)</label>
      <input
        type="number"
        min="50"
        value={values.subscriptionPrice}
        onChange={(e) => update("subscriptionPrice", e.target.value)}
        placeholder="Disabled"
        className="w-full rounded-xl bg-[#0d1420] border border-white/10 px-3 py-2 text-sm text-white"
      />
      <textarea
        value={values.subscriptionDescription}
        onChange={(e) => update("subscriptionDescription", e.target.value)}
        placeholder="What subscribers get..."
        rows={2}
        className="w-full rounded-xl bg-[#0d1420] border border-white/10 px-3 py-2 text-sm text-white resize-none"
      />
      <label className="block text-xs text-slate-400">Minimum tip (coins)</label>
      <input
        type="number"
        min="1"
        value={values.tipMinCoins}
        onChange={(e) => update("tipMinCoins", e.target.value)}
        className="w-full rounded-xl bg-[#0d1420] border border-white/10 px-3 py-2 text-sm text-white"
      />
      <label className="block text-xs text-slate-400">Paid DM price (coins, empty = free)</label>
      <input
        type="number"
        min="10"
        value={values.paidDmPrice}
        onChange={(e) => update("paidDmPrice", e.target.value)}
        placeholder="Free DMs"
        className="w-full rounded-xl bg-[#0d1420] border border-white/10 px-3 py-2 text-sm text-white"
      />
      <PrimaryButton onClick={save} disabled={saving} className="w-full rounded-xl">
        {saving ? "Saving..." : "Save monetization settings"}
      </PrimaryButton>
    </section>
  );
}
