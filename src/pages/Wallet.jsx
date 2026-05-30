import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const COIN_PACKAGES = [
  { id: 1, coins: 100, price: "$1.29", bonus: null, color: "from-amber-400 to-yellow-600" },
  { id: 2, coins: 500, price: "$5.99", bonus: "+50 coins", color: "from-blue-400 to-indigo-600", popular: true },
  { id: 3, coins: 1000, price: "$10.99", bonus: "+150 coins", color: "from-purple-500 to-pink-600" },
  { id: 4, coins: 5000, price: "$49.99", bonus: "+1000 coins", color: "from-emerald-400 to-teal-600" },
];

export default function Wallet() {
  const [activeTab, setActiveTab] = useState("coins");
  const coinBalance = 450;
  const totalEarnings = 1245.50;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      {/* Dynamic Backgrounds based on tab */}
      <AnimatePresence>
        {activeTab === "coins" ? (
          <motion.div key="bg-coins" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] bg-yellow-500/10 blur-[120px] rounded-full pointer-events-none z-0" />
        ) : (
          <motion.div key="bg-earnings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute top-[-10%] right-[-10%] w-[60%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none z-0" />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="shrink-0 px-4 py-4 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/profile" className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        <h1 className="text-base font-bold tracking-wide absolute left-1/2 -translate-x-1/2">Wallet</h1>
        <button className="text-slate-400 p-2 hover:text-white transition-colors">
          <span className="material-symbols-outlined">receipt_long</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-[#101822] p-1.5 shrink-0 z-10 relative shadow-md">
         <button onClick={() => setActiveTab("coins")} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all relative ${activeTab === "coins" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
            My Coins
            {activeTab === "coins" && <motion.div layoutId="walletTab" className="absolute inset-0 bg-white/5 rounded-xl border border-white/10" />}
         </button>
         <button onClick={() => setActiveTab("earnings")} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all relative ${activeTab === "earnings" ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
            Earnings
            {activeTab === "earnings" && <motion.div layoutId="walletTab" className="absolute inset-0 bg-white/5 rounded-xl border border-white/10" />}
         </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar relative z-10 p-4">
        <AnimatePresence mode="wait">
          {activeTab === "coins" ? (
            <motion.div key="coins" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="max-w-md mx-auto space-y-6 pb-10">
               {/* Balance Card */}
               <div className="bg-gradient-to-br from-amber-500/20 to-yellow-600/5 border border-amber-500/20 rounded-3xl p-6 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-2xl rounded-full pointer-events-none" />
                  <span className="material-symbols-outlined text-yellow-500 text-[48px] drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] mb-2">toll</span>
                  <p className="text-slate-300 text-sm font-medium">Coin Balance</p>
                  <p className="text-4xl font-black text-white mt-1">{coinBalance}</p>
               </div>

               <div>
                 <h2 className="text-sm font-bold text-slate-300 mb-4 px-1">Buy Coins</h2>
                 <div className="grid grid-cols-2 gap-3">
                    {COIN_PACKAGES.map((pkg, i) => (
                      <motion.button 
                        key={pkg.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group ${pkg.popular ? 'ring-1 ring-[#3b82f6]/50' : ''}`}
                      >
                         {pkg.popular && (
                           <div className="absolute top-0 inset-x-0 bg-[#3b82f6] text-[10px] font-bold py-0.5 uppercase tracking-wider">Most Popular</div>
                         )}
                         <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center shadow-lg mb-3 ${pkg.popular ? 'mt-3' : ''}`}>
                            <span className="material-symbols-outlined text-white">toll</span>
                         </div>
                         <p className="font-bold text-lg">{pkg.coins}</p>
                         {pkg.bonus ? (
                           <p className="text-[10px] text-emerald-400 font-bold mb-2">{pkg.bonus}</p>
                         ) : (
                           <p className="text-[10px] text-transparent mb-2">none</p>
                         )}
                         <div className="w-full py-2 bg-white/10 rounded-lg text-sm font-semibold group-hover:bg-white/20 transition-colors">
                           {pkg.price}
                         </div>
                      </motion.button>
                    ))}
                 </div>
               </div>
            </motion.div>
          ) : (
            <motion.div key="earnings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-md mx-auto space-y-6 pb-10">
               {/* Earnings Card */}
               <div className="bg-gradient-to-br from-emerald-500/20 to-teal-600/5 border border-emerald-500/20 rounded-3xl p-6 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-2xl rounded-full pointer-events-none" />
                  <span className="material-symbols-outlined text-emerald-400 text-[48px] drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] mb-2">account_balance_wallet</span>
                  <p className="text-slate-300 text-sm font-medium">Estimated Earnings</p>
                  <p className="text-4xl font-black text-white mt-1">${totalEarnings.toFixed(2)}</p>
                  <div className="mt-6 flex gap-3">
                     <PrimaryButton className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black border-none" size="sm">Withdraw</PrimaryButton>
                     <PrimaryButton variant="secondary" className="flex-1" size="sm">History</PrimaryButton>
                  </div>
               </div>

               {/* Chart Mockup */}
               <div className="bg-white/5 border border-white/10 rounded-3xl p-5">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-sm">Revenue (Last 7 Days)</h3>
                     <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full font-bold">+24%</span>
                  </div>
                  <div className="h-40 flex items-end justify-between gap-2 px-1">
                     {[20, 35, 25, 60, 45, 80, 50].map((h, i) => (
                       <div key={i} className="w-full group relative flex justify-center h-full items-end">
                         <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 1, delay: i * 0.1 }} className="w-full bg-emerald-500 rounded-t-md opacity-80 group-hover:opacity-100 transition-opacity" />
                       </div>
                     ))}
                  </div>
                  <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-bold uppercase px-2">
                     <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
