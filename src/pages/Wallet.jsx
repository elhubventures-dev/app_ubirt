import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { dataProvider } from "@/api/dataProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/use-toast";
import { usePaystackPayment } from "react-paystack";
import { COIN_PACKAGES } from "@/lib/coinPackages";
import {
  getActiveGatewayLabel,
  getPaystackAmount,
  PAYMENT_CURRENCY,
  PAYMENT_GATEWAY,
  startFincraCheckout,
} from "@/lib/paymentGateways";

export default function Wallet() {
  const { user, updateUserSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  const { data: balance } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => dataProvider.getWalletBalance(),
  });

  const { data: transactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ["wallet-transactions"],
    queryFn: () => dataProvider.getTransactions(),
  });

  const displayBalance = balance ?? user?.coins ?? 0;
  const gatewayLabel = getActiveGatewayLabel();

  const paystackConfig = {
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
    email: user?.email || "user@example.com",
    currency: PAYMENT_CURRENCY,
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const refreshWallet = async () => {
    try {
      const coins = await dataProvider.getWalletBalance();
      updateUserSession?.({ coins });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
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
      description: `Reference: ${reference}. Updating your balance...`,
    });

    setSearchParams({}, { replace: true });
    setTimeout(refreshWallet, 3000);
  }, [searchParams, setSearchParams, toast]);

  const onPaystackSuccess = async (reference) => {
    setIsPurchasing(false);
    toast({
      title: "Payment Successful!",
      description: `Reference: ${reference.reference}. Updating your balance...`,
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

  return (
    <div className="min-h-screen bg-[#101822] text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f59e0b]/20 blur-[120px] rounded-full z-0 pointer-events-none" />

      <header className="relative z-10 px-4 py-4 flex items-center border-b border-white/5 bg-[#101822]/50 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-slate-400 p-2 hover:text-white rounded-full bg-white/5 transition-colors mr-4">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold flex-1 text-center pr-10">Wallet</h1>
      </header>

      <main className="flex-1 relative z-10 p-6 max-w-md mx-auto w-full flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 shadow-[0_10px_30px_rgba(245,158,11,0.3)] text-center relative overflow-hidden"
        >
          <div className="absolute top-[-20%] right-[-10%] text-white/20">
            <span className="material-symbols-outlined text-[120px]">monetization_on</span>
          </div>
          <p className="text-white/80 font-semibold mb-1 relative z-10">Total Balance</p>
          <div className="flex items-center justify-center gap-2 relative z-10">
            <span className="material-symbols-outlined text-4xl text-amber-100">monetization_on</span>
            <span className="text-5xl font-black text-white tracking-tight">{displayBalance.toLocaleString()}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Buy Coins</h2>
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
          className="mt-4 pb-10"
        >
          <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
          {isLoadingTx ? (
            <p className="text-slate-400 text-sm">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p className="text-slate-400 text-sm">No transactions yet. Buy coins to get started.</p>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => {
                const isCredit = tx.coins > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCredit ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isCredit ? "add_circle" : "card_giftcard"}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{tx.label}</p>
                        <p className="text-xs text-slate-400">{tx.time}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${isCredit ? "text-green-400" : "text-red-400"}`}>
                      {isCredit ? "+" : ""}
                      {tx.coins}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
