/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wallet, Play, Sparkles, User, Loader2, DollarSign, Eye } from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
    TelegaIn?: any;
    telegaAds?: any;
  }
}

export default function App() {
  const [balance, setBalance] = useState<number | null>(null);
  const [adsWatched, setAdsWatched] = useState<number | null>(null);
  const [username, setUsername] = useState<string>("User");
  const [userId, setUserId] = useState<string>("guest");
  const [isWatching, setIsWatching] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Telegram and fetch data
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    let currentUserId = "guest";
    
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setUsername(user.username || user.first_name || "User");
        currentUserId = String(user.id);
        setUserId(currentUserId);
      }
    }

    // Initial fetch
    fetch("/api/balance", {
      headers: { "x-user-id": currentUserId }
    })
      .then((res) => res.json())
      .then((data) => {
        setBalance(data.balance);
        setAdsWatched(data.adsWatched);
        setLoading(false);
      })
      .catch(err => {
        console.error("API Error:", err);
        setError("Failed to connect to rewards server");
        setLoading(false);
      });
  }, []);

  const startAd = () => {
    setError(null);
    if (window.telegaAds) {
      setIsWatching(true);
      window.telegaAds.ad_show({
        adBlockUuid: "e97a3084-fb7c-46f9-9f2b-dd876bc2bd47"
      }).then((result: any) => {
        if (result && result.done) {
          completeAd();
        } else {
          setIsWatching(false);
          // Handle specific case where no ad was available from SDK
          setError("No ads available right now. Please try again later.");
        }
      }).catch((err: any) => {
        console.error("SDK Error:", err);
        setIsWatching(false);
        // Display the specific error message provided by the SDK
        setError(err?.message || "No ad available at the moment");
      });
    } else {
      // Manual simulation if SDK is missing (e.g. local development)
      setIsWatching(true);
      setCountdown(5);
    }
  };

  useEffect(() => {
    if (isWatching && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isWatching && countdown === 0 && !window.telegaAds) {
      // Only complete simulated if SDK wasn't used
      completeAd();
    }
  }, [isWatching, countdown]);

  const completeAd = async () => {
    try {
      const res = await fetch("/api/watch-ad", { 
        method: "POST",
        headers: { "x-user-id": userId }
      });
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
        setAdsWatched(data.adsWatched);
        
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#6366f1", "#10b981", "#fbbf24"]
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
      <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faff] text-slate-900 font-sans flex flex-col items-center justify-center p-4">
      {/* User Info Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8 bg-white px-6 py-3 rounded-2xl shadow-sm border border-indigo-50"
      >
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <User size={20} />
        </div>
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider leading-none mb-1">Welcome back</p>
          <p className="text-sm font-bold text-slate-800">{username}</p>
        </div>
      </motion.div>

      {/* Main Earn Box */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(79,70,229,0.08)] border border-indigo-50 relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-8 rotate-3">
            <DollarSign size={36} />
          </div>

          <h2 className="text-5xl font-black text-slate-900 mb-2 leading-none">
            ${balance ?? 0}
          </h2>
          <p className="text-slate-400 font-medium mb-6">Current Balance</p>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl mb-6 border border-red-100"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-4 w-full mb-10">
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center border border-slate-100">
              <Eye size={20} className="text-indigo-400 mb-2" />
              <div className="text-lg font-bold leading-none">{adsWatched ?? 0}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Ads Watched</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center border border-slate-100">
              <Wallet size={20} className="text-emerald-400 mb-2" />
              <div className="text-lg font-bold leading-none">$1.00</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Reward/Ad</div>
            </div>
          </div>

          <motion.button
            whileHover={!isWatching ? { scale: 1.05 } : {}}
            whileTap={!isWatching ? { scale: 0.95 } : {}}
            onClick={startAd}
            disabled={isWatching}
            className={cn(
              "w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all",
              isWatching 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                : "bg-indigo-600 text-white shadow-[0_10px_30px_rgba(79,70,229,0.3)] hover:bg-indigo-700"
            )}
            id="watch-ads-btn"
          >
            {isWatching ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>PLaying ({countdown}s)</span>
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" />
                <span>WATCH ADS NOW</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -ml-10 -mb-10 opacity-40" />
      </motion.div>

      {/* Simple Footer */}
      <p className="mt-8 text-slate-300 text-xs font-bold tracking-widest uppercase">
        Verified AdEarn Network
      </p>

      {/* Ad Overlay (Simulated fallback) */}
      <AnimatePresence>
        {isWatching && !window.telegaAds && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-full max-w-lg aspect-square bg-white rounded-[3rem] p-12 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5" />
              
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }} 
                transition={{ duration: 2, repeat: Infinity }}
                className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 mb-8"
              >
                <Sparkles size={40} />
              </motion.div>
              
              <h3 className="text-3xl font-black text-slate-900 mb-4">Amazing Product</h3>
              <p className="text-slate-400 font-medium max-w-[200px] mb-8">This is where your sponsored content would be displayed.</p>

              <div className="relative w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-2">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 5, ease: "linear" }}
                  className="h-full bg-indigo-600"
                />
              </div>
              <div className="text-indigo-600 font-black text-sm tracking-widest">
                {countdown} SECONDS REMAINING
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
