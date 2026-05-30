import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/use-toast";

const COIN_PACKAGES = [
  { id: "pack1", coins: 100, price: "$0.99" },
  { id: "pack2", coins: 500, price: "$4.99", popular: true },
  { id: "pack3", coins: 1200, price: "$9.99" },
  { id: "pack4", coins: 6500, price: "$49.99" },
];

export default function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handlePurchase = (pack) => {
    setIsPurchasing(true);
    // Simulate purchase network request
    setTimeout(() => {
      setIsPurchasing(false);
      toast({
        title: "Purchase Successful!",
        description: `You bought ${pack.coins} coins for ${pack.price}. (Mocked)`,
      });
      // We would update the user's coin balance here in a real app
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#101822] text-white flex flex-col relative overflow-hidden">
      {/* Aesthetics */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f59e0b]/20 blur-[120px] rounded-full z-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-4 py-4 flex items-center border-b border-white/5 bg-[#101822]/50 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-slate-400 p-2 hover:text-white rounded-full bg-white/5 transition-colors mr-4">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold flex-1 text-center pr-10">Wallet</h1>
      </header>

      <main className="flex-1 relative z-10 p-6 max-w-md mx-auto w-full flex flex-col gap-8">
        
        {/* Balance Card */}
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
            <span className="text-5xl font-black text-white tracking-tight">{user?.coins?.toLocaleString() || "0"}</span>
          </div>
        </motion.div>

        {/* Buy Coins Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-4"
        >
          <h2 className="text-lg font-bold">Buy Coins</h2>
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
                    <p className="font-bold text-lg">{pack.coins} <span className="text-sm font-normal text-slate-400">Coins</span></p>
                  </div>
                </div>
                <PrimaryButton 
                  onClick={() => handlePurchase(pack)}
                  disabled={isPurchasing}
                  className="rounded-full py-2 px-6"
                >
                  {pack.price}
                </PrimaryButton>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Transaction History Mock */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 pb-10"
        >
          <h2 className="text-lg font-bold mb-4">Recent Transactions</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">card_giftcard</span>
                </div>
                <div>
                  <p className="font-semibold">Gift to @creator</p>
                  <p className="text-xs text-slate-400">Today, 2:30 PM</p>
                </div>
              </div>
              <span className="font-bold text-red-400">-50</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                </div>
                <div>
                  <p className="font-semibold">Signup Bonus</p>
                  <p className="text-xs text-slate-400">Yesterday</p>
                </div>
              </div>
              <span className="font-bold text-green-400">+1000</span>
            </div>
          </div>
        </motion.div>

      </main>
    </div>
  );
}
