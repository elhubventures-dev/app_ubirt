import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { dataProvider } from "@/api/dataProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/use-toast";
import { usePaystackPayment } from "react-paystack";
import PageHeader from "@/components/layout/PageHeader";
import {
  getActiveGatewayLabel,
  getPaystackAmount,
  PAYMENT_CURRENCY,
  PAYMENT_GATEWAY,
  startFincraCheckout,
} from "@/lib/paymentGateways";

const EMPTY_WALLET = { platformCoins: 0, giftCoins: 0 };

export default function Wallet() {
  const { user, updateUserSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const { data: wallet = EMPTY_WALLET } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => dataProvider.getWalletBalance(),
  });

  const { data: transactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: () => dataProvider.getTransactions(),
  });

  const platformCoins = wallet.platformCoins ?? user?.coins ?? 0;
  const giftCoins = wallet.giftCoins ?? user?.giftCoins ?? 0;
  const gatewayLabel = getActiveGatewayLabel();

  const paystackConfig = {
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
    email: user?.email || "user@example.com",
    currency: PAYMENT_CURRENCY,
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const syncWalletSession = (balances) => {
    updateUserSession?.({
      coins: balances.platformCoins,
      giftCoins: balances.giftCoins,
    });
    queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
    queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
  };

  const refreshWallet = async () => {
    try {
      const balances = await dataProvider.getWalletBalance();
      syncWalletSession(balances);
    } catch {
      // Webhook may still be processing
    }
  };

  useEffect(() => {
    const paymentReturn = searchParams.get("payment");
    const reference = searchParams.get("reference");
    if (paymentReturn !== "return" || !reference) return;

    toast({
      title: "Payment received",
      description: `Reference: ${reference}. Updating your platform balance...`,
    });

    setSearchParams({}, { replace: true });
    setTimeout(refreshWallet, 3000);
  }, [searchParams, setSearchParams, toast]);

  const onPaystackSuccess = async (reference) => {
    setIsPurchasing(false);
    toast({
      title: "Payment Successful!",
      description: `Reference: ${reference.reference}. Updating your platform balance...`,
    });
    setTimeout(refreshWallet, 3000);
  };

  const onPaystackClose = () => {
    setIsPurchasing(false);
    toast({
      title: "Payment Cancelled",
      description: "You closed the payment window.",
      variant: "destructive",
    });
  };

  const handlePurchase = async (pack) => {
    setIsPurchasing(true);
    setPurchaseError("");

    try {
      if (PAYMENT_GATEWAY === "fincra") {
        await startFincraCheckout(pack);
        return;
      }

      if (PAYMENT_GATEWAY === "paystack") {
        const config = {
          ...paystackConfig,
          amount: getPaystackAmount(pack),
          metadata: {
            userId: user?.id,
            coins: pack.coins,
          },
        };
        initializePayment(onPaystackSuccess, onPaystackClose, config);
        return;
      }

      throw new Error(`Unsupported payment gateway: ${PAYMENT_GATEWAY}`);
    } catch (err) {
      const message = err.message || "Unable to start payment.";
      setPurchaseError(message);
      toast({
        title: "Checkout failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (PAYMENT_GATEWAY === "fincra") {
        setIsPurchasing(false);
      }
    }
  };

  const handleConvert = async (amountOverride) => {
    const amount = amountOverride ?? parseInt(convertAmount, 10);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter how many gift coins to convert.",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);
    try {
      const result = await dataProvider.convertGiftCoins(amount);
      syncWalletSession({
        platformCoins: result.platformCoins,
        giftCoins: result.giftCoins,
      });
      setConvertAmount("");
      toast({
        title: "Conversion complete",
        description: `${result.amount.toLocaleString()} gift coins moved to your platform wallet.`,
      });
    } catch (err) {
      toast({
        title: "Conversion failed",
        description: err.message || "Unable to convert gift coins.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101822] text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f59e0b]/20 blur-[120px] rounded-full z-0 pointer-events-none" />

      <PageHeader onBack={() => navigate(-1)} title="Wallet" className="bg-[#101822]/50" />

      <main className="flex-1 relative z-10 p-6 max-w-md mx-auto w-full flex flex-col gap-6 pb-10">
        <div className="grid grid-cols-1 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-5 shadow-[0_10px_30px_rgba(245,158,11,0.3)] relative overflow-hidden"
          >
            <div className="absolute top-[-20%] right-[-10%] text-white/20">
              <span className="material-symbols-outlined text-[100px]">monetization_on</span>
            </div>
            <p className="text-white/80 font-semibold mb-1 relative z-10">Platform Coins</p>
            <p className="text-xs text-white/70 relative z-10 mb-3">Purchases, signup bonus · used on the app</p>
            <div className="flex items-center gap-2 relative z-10">
              <span className="material-symbols-outlined text-3xl text-amber-100">monetization_on</span>
              <span className="text-4xl font-black text-white tracking-tight">{platformCoins.toLocaleString()}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-3xl p-5 shadow-[0_10px_30px_rgba(139,92,246,0.25)] relative overflow-hidden"
          >
            <div className="absolute top-[-20%] right-[-10%] text-white/20">
              <span className="material-symbols-outlined text-[100px]">featured_seasonal_and_gifts</span>
            </div>
            <p className="text-white/80 font-semibold mb-1 relative z-10">Gift Coins</p>
            <p className="text-xs text-white/70 relative z-10 mb-3">Earnings from fans · convert or withdraw</p>
            <div className="flex items-center gap-2 relative z-10">
              <span className="material-symbols-outlined text-3xl text-violet-100">featured_seasonal_and_gifts</span>
              <span className="text-4xl font-black text-white tracking-tight">{giftCoins.toLocaleString()}</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-3"
        >
          <div>
            <h2 className="text-lg font-bold">Convert Gift Coins</h2>
            <p className="text-xs text-slate-400 mt-1">
              Move gift coins into your platform wallet to spend on the app. Withdrawals coming soon.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max={giftCoins}
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 rounded-xl bg-[#0d1420] border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
            />
            <PrimaryButton
              onClick={() => handleConvert()}
              disabled={isConverting || giftCoins <= 0}
              className="rounded-xl px-5"
            >
              {isConverting ? "..." : "Convert"}
            </PrimaryButton>
          </div>
          {giftCoins > 0 ? (
            <button
              type="button"
              onClick={() => handleConvert(giftCoins)}
              disabled={isConverting}
              className="text-sm text-violet-300 hover:text-violet-200 text-left disabled:opacity-50"
            >
              Convert all {giftCoins.toLocaleString()} gift coins
            </button>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Buy Platform Coins</h2>
            <span className="text-xs text-slate-400">via {gatewayLabel}</span>
          </div>
          {purchaseError ? (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {purchaseError}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3">
            {COIN_PACKAGES.map((pack) => (
              <div key={pack.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors relative overflow-hidden">
                {pack.popular && (
                  <div className="absolute top-0 right-0 bg-red-500 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg tracking-wider">
                    POPULAR
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                    <span className="material-symbols-outlined text-2xl">monetization_on</span>
                  </div>
                  <div>
                    <p className="font-bold text-lg">
                      {pack.coins} <span className="text-sm font-normal text-slate-400">Coins</span>
                    </p>
                  </div>
                </div>
                <PrimaryButton
                  onClick={() => handlePurchase(pack)}
                  disabled={isPurchasing}
                  className="rounded-full py-2 px-6 min-w-[96px]"
                >
                  {isPurchasing ? "..." : pack.priceLabel}
                </PrimaryButton>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-bold mb-4">Purchase History</h2>
          {isLoadingTx ? (
            <p className="text-slate-400 text-sm">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-slate-400 text-sm">No purchases yet. Buy platform coins to get started.</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500/20 text-green-400">
                      <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    </div>
                    <div>
                      <p className="font-semibold">{tx.label}</p>
                      <p className="text-xs text-slate-400">{tx.time}</p>
                    </div>
                  </div>
                  <span className="font-bold text-green-400">+{tx.coins}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
