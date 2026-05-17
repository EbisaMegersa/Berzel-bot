/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Play, Eye, TrendingUp, DollarSign, Loader2, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";

export default function App() {
  const [balance, setBalance] = useState<number | null>(null);
  const [adsWatched, setAdsWatched] = useState<number | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    fetch("/api/balance")
      .then((res) => res.json())
      .then((data) => {
        setBalance(data.balance);
        setAdsWatched(data.adsWatched);
        setLoading(false);
      })
      .catch(err => {
        console.error("API Error:", err);
        setLoading(false);
      });
  }, []);

  const startAd = () => {
    setIsWatching(true);
    setCountdown(5); // 5 second ad simulation
  };

  useEffect(() => {
    if (isWatching && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isWatching && countdown === 0) {
      completeAd();
    }
  }, [isWatching, countdown]);

  const completeAd = async () => {
    try {
      const res = await fetch("/api/watch-ad", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
        setAdsWatched(data.adsWatched);
        
        // Celebration!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#22c55e", "#10b981", "#3b82f6"]
        });
      }
    } catch (err) {
      console.error("Failed to collect reward", err);
    } finally {
      setIsWatching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbff] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Top Navigation */}
      <nav className="border-b border-indigo-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-indigo-950">AdEarn</span>
          </div>
          <div className="flex items-center gap-4 bg-white border border-indigo-100 rounded-full px-4 py-1.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-indigo-600 font-semibold">
              <DollarSign size={16} />
              <span>{balance?.toFixed(2) || "0.00"}</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Main Balance Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-8 bg-white rounded-3xl p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group"
            id="balance-card"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-indigo-500 mb-2 font-medium bg-indigo-50 w-fit px-3 py-1 rounded-full text-sm">
                <TrendingUp size={14} />
                Rewards Wallet
              </div>
              <h2 className="text-6xl font-black text-indigo-950 mb-1 flex items-baseline gap-1">
                <span className="text-4xl text-indigo-300 font-normal">$</span>
                {balance ?? 0}
              </h2>
              <p className="text-slate-500 mb-8">Earn credits by engaging with short advertisements.</p>
              
              <div className="flex flex-wrap gap-8 mt-12 pt-8 border-t border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Eye size={24} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-800 leading-none">{adsWatched ?? 0}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest mt-1">Total Views</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-800 leading-none">Instant</div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest mt-1">Payout Status</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Background Accent */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
          </motion.div>

          {/* Action Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-4 bg-indigo-600 rounded-3xl p-8 text-white flex flex-col justify-between shadow-xl shadow-indigo-200 relative overflow-hidden"
            id="action-card"
          >
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Claim $1.00</h3>
              <p className="text-indigo-100 text-sm mb-6">Watch a brief 5-second advertisement to boost your balance.</p>
            </div>

            <motion.button
              whileHover={!isWatching ? { scale: 1.02 } : {}}
              whileTap={!isWatching ? { scale: 0.98 } : {}}
              onClick={startAd}
              disabled={isWatching}
              className={cn(
                "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all relative z-10",
                isWatching 
                  ? "bg-indigo-700/50 cursor-not-allowed" 
                  : "bg-white text-indigo-600 shadow-lg shadow-indigo-900/20"
              )}
              id="watch-ads-btn"
            >
              {isWatching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Ad Playing ({countdown}s)</span>
                </>
              ) : (
                <>
                  <Play size={20} fill="currentColor" />
                  <span>Watch Ad Now</span>
                </>
              )}
            </motion.button>

            {/* Background Graphic */}
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </motion.div>

        </div>

        {/* Ad Player Layer */}
        <AnimatePresence>
          {isWatching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-2xl aspect-video bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-white/5 relative flex flex-col items-center justify-center"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-violet-500/20" />
                
                <div className="relative z-10 text-center">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 bg-indigo-500/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10"
                  >
                    <Sparkles className="text-white w-10 h-10" />
                  </motion.div>
                  <h4 className="text-white text-2xl font-bold mb-2">Exclusive Preview</h4>
                  <p className="text-indigo-200/60 text-sm max-w-sm mx-auto">Discover the future of digital rewards and premium experiences.</p>
                </div>

                <div className="absolute top-8 right-8 flex items-center gap-3">
                  <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 text-white font-mono text-sm">
                    <span className="text-indigo-400 w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    {countdown}S
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="h-full bg-indigo-500"
                  />
                </div>

                <div className="absolute bottom-8 left-8 text-white/20 text-[10px] uppercase font-bold tracking-widest">
                  Sponsored Content Partner
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-12 border-t border-indigo-50 flex flex-col sm:flex-row justify-between items-center gap-6 text-slate-400 text-sm">
        <div className="flex items-center gap-6">
          <span className="hover:text-indigo-600 transition-colors cursor-pointer">Security</span>
          <span className="hover:text-indigo-600 transition-colors cursor-pointer">Rewards Policy</span>
          <span className="hover:text-indigo-600 transition-colors cursor-pointer">Contact</span>
        </div>
        <p>© 2024 AdEarn Inc. Verified Rewards Platform.</p>
      </footer>
    </div>
  );
}
