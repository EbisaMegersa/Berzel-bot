/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  MonitorPlay, 
  Loader2, 
  Home, 
  Zap, 
  Users, 
  Wallet, 
  User as UserIcon,
  Play,
  CircleDollarSign,
  ArrowUpRight,
  CheckCircle2,
  Bell,
  Check,
  ExternalLink,
  Share2,
  Gift,
  Copy,
  Clock,
  Trophy
} from 'lucide-react';
import { db, auth, authStatus } from './lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot, increment, query, collection, where, getDocs, limit, orderBy, addDoc, writeBatch } from 'firebase/firestore';

// --- Types ---
interface UserProfile {
  telegramId: number;
  username: string;
  adsWatched: number;
  balance: number;
  dailyStreak: number;
  lastDailyClaim: any;
  tasksCompleted: string[];
  referralsCount: number;
  total_invites: number;
  consumedInvites: number;
  referralEarnings: number;
  invitedBy: string | null;
  has_withdrawn: boolean;
  adsSinceLastWithdrawal: number;
  microTasksCompleted: number;
}

interface WithdrawalHistory {
  id: string;
  amount: number;
  method: string;
  status: 'Pending' | 'Success' | 'Rejected';
  createdAt: any;
}

const DAILY_REWARDS = [8, 12, 23, 32, 42, 58, 83]; // Points
const POINT_TO_USD = 0.006;

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UserData {
  id: number;
  username: string;
}

interface LeaderboardUser {
  id: string;
  username: string;
  adsWatched: number;
  telegramId: number;
  total_invites?: number;
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [isVerifyingTask, setIsVerifyingTask] = useState(false);
  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [error, setError] = useState<string | null>(null);
  const [withdrawalMethod, setWithdrawalMethod] = useState('usdt_trc20');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalAddress, setWithdrawalAddress] = useState('');
  const [withdrawalUid, setWithdrawalUid] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistory[]>([]);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);

  // Leaderboard State
  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState<'ads' | 'referrals'>('ads');

  // Micro Tasks State
  const [microTasksTimers, setMicroTasksTimers] = useState<Record<number, number>>({});
  const [microTasksActive, setMicroTasksActive] = useState<Record<number, boolean>>({});

  const [welcomeIndex, setWelcomeIndex] = useState(0);
  const welcomeMessages = [
    "Welcome to Task Tuner Rewards",
    "Prepare for earning",
    "Invite friends, grow together",
    "Almost ready..."
  ];

  // Initialize Telegram & Data
  useEffect(() => {
    const welcomeInterval = setInterval(() => {
      setWelcomeIndex(prev => (prev + 1) % welcomeMessages.length);
    }, 2000);

    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeHistory: (() => void) | undefined;

    const extractStartParam = (tg: any) => {
      if (tg.initDataUnsafe?.start_param) return tg.initDataUnsafe.start_param;
      try {
        const urlParams = new URLSearchParams(tg.initData);
        return urlParams.get('start_param');
      } catch (e) {
        return null;
      }
    };

    const init = async () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg) {
        setLoading(false);
        return;
      }

      tg.ready();
      tg.expand();
      
      // Theme Integration: Green Professional Theme
      try {
        tg.setHeaderColor('#10B981');
        tg.setBackgroundColor('#0B1010');
      } catch (e) {
        console.error("Theme set error", e);
      }

      if (!tg.initDataUnsafe?.user) {
        setLoading(false);
        return;
      }

      const user = tg.initDataUnsafe.user;
      
      unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
        if (!firebaseUser) {
          if (authStatus.restricted) {
            setError("AUTH_RESTRICTED");
            setLoading(false);
          }
          return;
        }

        // Cleanup existing listeners if any
        unsubscribeProfile?.();
        unsubscribeHistory?.();

        const userDocPath = `users/${firebaseUser.uid}`;
        const urlParams = new URL(window.location.href).searchParams;
      const inviterIdFromParam = urlParams.get('start_param') || extractStartParam(tg);
        
        const identity = {
          id: user.id,
          username: user.username || user.first_name || 'User'
        };
        setUserData(identity);

        // Profile Listener
        unsubscribeProfile = onSnapshot(doc(db, userDocPath), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
              setProfile({
                telegramId: data.telegramId || 0,
                username: data.username || 'User',
                adsWatched: data.adsWatched || 0,
                balance: data.balance || 0,
                dailyStreak: data.dailyStreak || 0,
                lastDailyClaim: data.lastDailyClaim,
                tasksCompleted: data.tasksCompleted || [],
                referralsCount: data.referralsCount || 0,
                total_invites: data.total_invites || 0,
                consumedInvites: data.consumedInvites || 0,
                referralEarnings: data.referralEarnings || 0,
                invitedBy: data.invitedBy || null,
                has_withdrawn: data.has_withdrawn || false,
                adsSinceLastWithdrawal: data.adsSinceLastWithdrawal || 0,
                microTasksCompleted: data.microTasksCompleted || 0
              });
            setLoading(false);
          } else {
            // NEW USER REGISTRATION
            try {
              let inviterIdStr = inviterIdFromParam ? String(inviterIdFromParam) : null;
              if (inviterIdFromParam && String(inviterIdFromParam) !== String(user.id)) {
                try {
                  console.log("Processing Referral for inviter:", inviterIdFromParam);
                  const inviterRef = collection(db, "users");
                  const q = query(inviterRef, where("telegramId", "==", parseInt(String(inviterIdFromParam))), limit(1));
                  const querySnapshot = await getDocs(q);
                  
                  if (!querySnapshot.empty) {
                    const inviterDoc = querySnapshot.docs[0];
                    // Record their Firestore ID if found, otherwise we keep the telegram ID string
                    // But for "invitedBy" field, storing Telegram ID might be clearer if they are looking at it.
                    // Let's store "tg_" prefix for clarity if it's just a raw ID.
                    
                    console.log("Found inviter doc:", inviterDoc.id);

                    // Reward inviter (50 pts)
                    await updateDoc(doc(db, "users", inviterDoc.id), {
                      balance: increment(50),
                      referralsCount: increment(1),
                      total_invites: increment(1),
                      referralEarnings: increment(50),
                      updatedAt: serverTimestamp()
                    });

                    // Track in sub-collection for real-time join feed if needed later
                    await setDoc(doc(db, `users/${inviterDoc.id}/referrals/${user.id}`), {
                      telegramId: user.id,
                      username: identity.username,
                      joinedAt: serverTimestamp()
                    });
                    
                    tg.showAlert(`Welcome! You got 10 points welcome bonus`);
                    tg.HapticFeedback?.notificationOccurred('success');
                  } else {
                    console.warn("Inviter NOT found in database for ID:", inviterIdFromParam);
                  }
                } catch (refErr) {
                  console.error("Referral Logic Failure:", refErr);
                }
              }
              
              const initialProfile = {
                telegramId: user.id,
                username: identity.username,
                adsWatched: 0,
                balance: inviterIdStr ? 10 : 0, // 10 pts welcome bonus if referred
                dailyStreak: 0,
                lastDailyClaim: null,
                tasksCompleted: [],
                referralsCount: 0,
                total_invites: 0,
                consumedInvites: 0,
                referralEarnings: 0,
                invitedBy: inviterIdStr,
                has_withdrawn: false,
                adsSinceLastWithdrawal: 0,
                microTasksCompleted: 0,
                updatedAt: serverTimestamp()
              };
              await setDoc(doc(db, userDocPath), initialProfile);
            } catch (e) {
              console.error("Registration Error", e);
              setError("Failed to create profile. Try refreshing.");
              setLoading(false);
            }
          }
        }, (err) => {
          console.error("Profile Snapshot Error", err);
          setError("Database connection error. Try again later.");
          setLoading(false);
        });

        // Withdrawal History Listener
        const historyRef = collection(db, `${userDocPath}/withdrawals`);
        // Note: orderBy requires index. If it fails, we'll know from console.
        const qHistory = query(historyRef, orderBy('createdAt', 'desc'), limit(20));
        unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
          const history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as WithdrawalHistory));
          setWithdrawalHistory(history);
        }, (err) => {
          console.error("History Snapshot Error:", err);
          // Fallback query if orderBy fails (no index yet?)
          onSnapshot(query(historyRef, limit(20)), (snap) => {
             const history = snap.docs.map(d => ({ id: d.id, ...d.data() } as WithdrawalHistory));
             // Manual client-side sort as fallback
             history.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
             setWithdrawalHistory(history);
          });
        });
      });
    };

    init();
    return () => {
      clearInterval(welcomeInterval);
      unsubscribeAuth?.();
      unsubscribeProfile?.();
      unsubscribeHistory?.();
    };
  }, []);

  // Timer Effect for Micro Tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setMicroTasksTimers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          const id = parseInt(key);
          if (next[id] > 0) {
            next[id] -= 1;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleWatchAd = async () => {
    if (isWatching || !auth.currentUser) return;
    
    setIsWatching(true);

    const rewardUser = async () => {
      if (!auth.currentUser) return;
      const userDocPath = `users/${auth.currentUser.uid}`;
      try {
        await updateDoc(doc(db, userDocPath), {
          adsWatched: increment(1),
          adsSinceLastWithdrawal: increment(1),
          balance: increment(2), // 2 points per ad
          updatedAt: serverTimestamp()
        });
        
        try {
          (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch {}
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userDocPath);
      } finally {
        setIsWatching(false);
      }
    };
    
    const adFn = (window as any).show_10937696;
    if (typeof adFn === 'function') {
      try {
        adFn().then(() => {
          try {
            (window as any).Telegram?.WebApp?.showAlert('You have seen an ad!');
          } catch {
            alert('You have seen an ad!');
          }
          rewardUser();
        }).catch((err: any) => {
          console.error("Ad SDK error:", err);
          setIsWatching(false);
        });
      } catch (err) {
        console.error("Ad SDK sync error:", err);
        setIsWatching(false);
      }
    } else {
      setTimeout(rewardUser, 3000);
    }
  };

  const handleDailyCheckIn = async () => {
    if (isClaimingDaily || !auth.currentUser || !profile) return;
    
    const now = Date.now();
    const lastClaim = profile.lastDailyClaim ? profile.lastDailyClaim.toMillis() : 0;
    const diffHours = (now - lastClaim) / (1000 * 60 * 60);

    // Can only claim once every 24 hours
    if (diffHours < 24 && profile.lastDailyClaim) {
      alert(`Come back in ${Math.ceil(24 - diffHours)} hours!`);
      return;
    }

    setIsClaimingDaily(true);
    const userDocPath = `users/${auth.currentUser.uid}`;

    try {
      let newStreak = profile.dailyStreak;
      
      // If claimed more than 48 hours ago, reset streak (missed a day)
      // Or if it's the very first claim
      if (diffHours > 48 || !profile.lastDailyClaim) {
        newStreak = 1;
      } else {
        newStreak = (newStreak % 7) + 1;
      }

      const reward = DAILY_REWARDS[newStreak - 1];

      await updateDoc(doc(db, userDocPath), {
        balance: increment(reward),
        dailyStreak: newStreak,
        lastDailyClaim: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      } catch {}

      alert(`Day ${newStreak} Claimed! Reward: ${reward} points`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    } finally {
      setIsClaimingDaily(false);
    }
  };

  const handleJoinTelegram = async () => {
    if (isVerifyingTask || !auth.currentUser || !profile) return;
    if (profile.tasksCompleted.includes('tg_join')) {
      alert("Task already completed!");
      return;
    }

    setIsVerifyingTask(true);
    const userDocPath = `users/${auth.currentUser.uid}`;

    try {
      // Small delay to simulate verification
      await new Promise(resolve => setTimeout(resolve, 2000));

      await updateDoc(doc(db, userDocPath), {
        balance: increment(10), // 10 points for joining channel
        tasksCompleted: [...profile.tasksCompleted, 'tg_join'],
        updatedAt: serverTimestamp()
      });

      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
      alert("Successfully verified! 10 points added to your balance.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    } finally {
      setIsVerifyingTask(false);
    }
  };

  const handleMicroTaskVisit = (id: number) => {
    const adFn = (window as any).show_10937696;
    if (typeof adFn === 'function') {
      adFn('pop').then(() => {
        setMicroTasksTimers(prev => ({ ...prev, [id]: 30 }));
        setMicroTasksActive(prev => ({ ...prev, [id]: true }));
      }).catch((e: any) => {
        console.error("Micro task ad error:", e);
        setMicroTasksTimers(prev => ({ ...prev, [id]: 30 }));
        setMicroTasksActive(prev => ({ ...prev, [id]: true }));
      });
    } else {
      // Fallback if ad SDK not loaded
      setMicroTasksTimers(prev => ({ ...prev, [id]: 30 }));
      setMicroTasksActive(prev => ({ ...prev, [id]: true }));
    }
  };

  const handleMicroTaskClaim = async (id: number) => {
    if (!auth.currentUser || !profile) return;

    const userDocPath = `users/${auth.currentUser.uid}`;
    try {
      await updateDoc(doc(db, userDocPath), {
        balance: increment(4), // 4 points per micro task
        microTasksCompleted: increment(1),
        updatedAt: serverTimestamp()
      });
      
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        (window as any).Telegram?.WebApp?.showAlert('Task Completed! 4 points added.');
      } catch {
        alert('Task Completed! 4 points added.');
      }

      // Reset state for this task immediately so user can do it again
      setMicroTasksActive(prev => ({ ...prev, [id]: false }));
      setMicroTasksTimers(prev => ({ ...prev, [id]: 0 }));

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
    }
  };

  const referralLink = profile ? `https://t.me/Tasktuner_bot?startapp=${profile.telegramId}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    try {
      (window as any).Telegram?.WebApp?.showAlert('Referral link copied to clipboard!');
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {
      alert('Copied!');
    }
  };

  const handleShare = () => {
    const text = encodeURIComponent("Join this bot and earn rewards! \ud83d\ude80");
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    (window as any).Telegram?.WebApp?.openTelegramLink(url);
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const usersRef = collection(db, 'users');
      const sortField = leaderboardType === 'ads' ? 'adsWatched' : 'total_invites';
      const q = query(usersRef, orderBy(sortField, 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      const leaderboardData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as LeaderboardUser));
      setLeaderboardUsers(leaderboardData);
    } catch (err) {
      console.error("Leaderboard Fetch Error:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab, leaderboardType]);

  const handleWithdraw = async () => {
    if (!profile || !auth.currentUser || isWithdrawing) return;

    const amountNum = parseFloat(withdrawalAmount);
    
    // 1. Minimum Amount Check
    if (isNaN(amountNum) || amountNum < 1667) {
      alert('Minimum withdrawal is 1667 points.');
      return;
    }

    // 2. Balance Check
    if (amountNum > profile.balance) {
      alert('Insufficient balance.');
      return;
    }

    // 3. Lock System Check
    const availableInvites = (profile.total_invites || 0) - (profile.consumedInvites || 0);
    const meetsInvites = availableInvites >= 20;
    const adRequirement = 25;
    const meetsAds = (profile.adsSinceLastWithdrawal || 0) >= adRequirement;

    if (!meetsInvites || !meetsAds) {
      if (!meetsInvites) {
        alert(`❌ Requirement Not Met: You need to invite 20 friends to unlock this withdrawal. You currently have ${availableInvites}/20. Keep sharing your link!`);
      } else {
        alert(`❌ Ads Required: To support the payout pool, you must view ${adRequirement} ads. You have completed ${profile.adsSinceLastWithdrawal}/${adRequirement}. Tap 'View Ads' to continue!`);
      }
      try {
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      } catch {}
      return;
    }

    // 4. Address Check (only if not Exchange)
    const isExchange = (withdrawalMethod === 'binance');
    if (!isExchange && !withdrawalAddress) {
      alert('Please enter a valid wallet address.');
      return;
    }

    // 5. UID Check for Exchanges
    if (isExchange && !withdrawalUid) {
      alert('UID is required for Exchange withdrawals.');
      return;
    }

    setIsWithdrawing(true);
    const userDocRef = doc(db, `users/${auth.currentUser.uid}`);
    const withdrawalColRef = collection(db, `users/${auth.currentUser.uid}/withdrawals`);
    const newWithdrawalDocRef = doc(withdrawalColRef);

    try {
      // Create Atomic Transaction (Write Batch)
      const batch = writeBatch(db);
      
      // 1. Deduct Balance
      batch.update(userDocRef, {
        balance: increment(-amountNum),
        updatedAt: serverTimestamp()
      });

      // 2. Create History Entry
      batch.set(newWithdrawalDocRef, {
        amount: amountNum,
        method: withdrawalMethod,
        address: withdrawalAddress || null,
        uid: withdrawalUid || null,
        status: 'Pending',
        createdAt: serverTimestamp(),
        userId: auth.currentUser.uid
      });

      // Commit Batch
      await batch.commit();

      setWithdrawalSuccess(true);
      
      try {
        (window as any).Telegram?.WebApp?.showAlert('\ud83c\udf89 Withdrawal Request Submitted!');
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      } catch {}
      
      setWithdrawalAmount('');
      setWithdrawalAddress('');
      setWithdrawalUid('');

      // Automated Transition after 6 hours
      const delayMs = 6 * 60 * 60 * 1000;

      setTimeout(async () => {
        try {
          const successBatch = writeBatch(db);
          successBatch.update(newWithdrawalDocRef, { status: 'Success' });
          successBatch.update(userDocRef, {
            consumedInvites: increment(20),
            has_withdrawn: true,
            adsSinceLastWithdrawal: 0,
            updatedAt: serverTimestamp()
          });
          await successBatch.commit();
          
          try {
             (window as any).Telegram?.WebApp?.showAlert('\u2705 Withdrawal Processed Successfully!');
             (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
          } catch {}
        } catch (err) {
          console.error("Delayed Withdrawal Update Error:", err);
        }
      }, delayMs);

      // Auto hide success message banner after 5 seconds
      setTimeout(() => setWithdrawalSuccess(false), 5000);
    } catch (err) {
      console.error("Withdrawal Error:", err);
      handleFirestoreError(err, OperationType.WRITE, userDocRef.path);
      try {
        (window as any).Telegram?.WebApp?.showAlert('\u274c Withdrawal failed. Please try again.');
        (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      } catch {}
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#061B1B] p-10 text-center overflow-hidden">
        <motion.div
          animate={{ 
            opacity: [1, 0.2, 1],
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative mb-12"
        >
          <div className="absolute inset-0 bg-[#10B981]/10 blur-[100px] rounded-full" />
          <svg width="240" height="240" viewBox="0 0 240 240" className="relative drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <circle cx="90" cy="90" r="80" stroke="#10B981" strokeWidth="1" fill="none" opacity="0.6" />
            <circle cx="150" cy="150" r="80" stroke="#10B981" strokeWidth="1" fill="none" opacity="0.6" />
            <path d="M90 10 A 80 80 0 0 1 170 90 A 80 80 0 0 1 90 170 A 80 80 0 0 1 10 90 A 80 80 0 0 1 90 10" stroke="#10B981" strokeWidth="0.5" fill="none" opacity="0.2" />
          </svg>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            key={welcomeIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl font-bold text-white tracking-tight uppercase">
              {welcomeMessages[welcomeIndex]}
            </h2>
          </motion.div>
          
          <div className="flex items-center justify-center gap-2">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: welcomeIndex === i ? [1, 1.2, 1] : 1,
                  opacity: welcomeIndex === i ? 1 : 0.3
                }}
                className={`w-1.5 h-1.5 rounded-full bg-[#10B981]`}
              />
            ))}
          </div>
        </div>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.5 }}
          className="text-[10px] text-white font-medium mt-12 uppercase tracking-[0.3em]"
        >
          Securing Connection...
        </motion.p>
      </div>
    );
  }

  if (error === "AUTH_RESTRICTED") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D0D0D] p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#EF4444]/10 flex items-center justify-center mb-6">
          <Zap className="w-10 h-10 text-[#EF4444]" />
        </div>
        <h2 className="text-2xl font-black text-white mb-4">Auth Disabled</h2>
        <div className="text-[#A0AEC0] text-sm mb-10 leading-relaxed text-left space-y-4">
          <p>This app requires **Anonymous Authentication** to be enabled in your Firebase Project.</p>
          <ol className="list-decimal list-inside space-y-2 font-bold text-white/80">
            <li>Open your Firebase Console</li>
            <li>Go to "Authentication"</li>
            <li>Click the "Sign-in method" tab</li>
            <li>Enable "Anonymous" provider</li>
          </ol>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="w-full h-16 rounded-2xl bg-white text-black font-black shadow-xl"
        >
          I'VE ENABLED IT, RETRY
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#061B1B] p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-6">
          <Bell className="w-10 h-10 text-[#10B981]" />
        </div>
        <h2 className="text-2xl font-black text-white mb-4">Connection Failed</h2>
        <p className="text-[#10B981] text-sm mb-10 leading-relaxed bg-[#10B981]/5 p-4 rounded-xl border border-[#10B981]/10">
          {error}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full h-16 rounded-2xl bg-white text-black font-black shadow-xl"
        >
          RETRY CONNECTION
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-[#061B1B] font-sans selection:bg-[#10B981]/30 overflow-x-hidden">
      {/* Header Section */}
      <header className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Leaderboard
          </h1>
          <p className="text-[10px] text-[#A0AEC0] mt-1 font-bold uppercase tracking-[0.2em]">
            Top 10 High-Performance Earners
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#059669] flex items-center justify-center border border-white/10 shadow-lg shadow-[#10B981]/10 p-0.5">
          <div className="w-full h-full rounded-[14px] bg-[#061B1B] flex items-center justify-center">
             <Trophy className="w-6 h-6 text-[#10B981]" />
          </div>
        </div>
      </header>

      <main className="px-6 pb-32">
          <div className="space-y-6">
            <div className="flex bg-white/5 p-1.5 rounded-[24px] border border-white/5">
              <button 
                onClick={() => setLeaderboardType('ads')}
                className={`flex-1 py-3.5 px-4 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${leaderboardType === 'ads' ? 'bg-[#10B981] text-[#061B1B] shadow-xl shadow-[#10B981]/20' : 'text-[#A0AEC0] hover:text-white hover:bg-white/5'}`}
              >
                Ads Watched
              </button>
              <button 
                onClick={() => setLeaderboardType('referrals')}
                className={`flex-1 py-3.5 px-4 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${leaderboardType === 'referrals' ? 'bg-[#10B981] text-[#061B1B] shadow-xl shadow-[#10B981]/20' : 'text-[#A0AEC0] hover:text-white hover:bg-white/5'}`}
              >
                Top Referrals
              </button>
            </div>

            <div className="stats-card rounded-[40px] overflow-hidden border border-white/5 shadow-2xl shadow-black/40">
              <div className="bg-[#10B981]/10 p-6 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-[#10B981] tracking-[0.3em]">Global Ranking</span>
                <span className="text-[10px] font-black uppercase text-[#10B981] tracking-[0.3em]">{leaderboardType === 'ads' ? 'Watch Count' : 'Invites'}</span>
              </div>

              {loadingLeaderboard ? (
                <div className="p-32 flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-[#10B981] animate-spin" />
                    <div className="absolute inset-0 bg-[#10B981]/20 blur-xl rounded-full animate-pulse" />
                  </div>
                  <p className="text-[10px] font-black text-[#A0AEC0] uppercase tracking-[0.3em] animate-pulse">Syncing Leaderboard...</p>
                </div>
              ) : leaderboardUsers.length === 0 ? (
                <div className="p-32 text-center">
                  <p className="text-[#A0AEC0] text-sm font-bold opacity-40 uppercase tracking-widest">No data available</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.03]">
                  {leaderboardUsers.map((user, index) => {
                    const isCurrentUser = user.telegramId === userData?.id;
                    const value = leaderboardType === 'ads' ? user.adsWatched : (user.total_invites || 0);
                    const label = leaderboardType === 'ads' ? 'Watches' : 'Invites';
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ 
                          duration: 0.4,
                          delay: index * 0.08,
                          ease: [0.23, 1, 0.32, 1]
                        }}
                        key={user.id} 
                        className={`flex items-center justify-between p-6 transition-all ${isCurrentUser ? 'bg-[#10B981]/10' : 'hover:bg-white/[0.02]'}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center font-black text-[8px] z-10 border-2 border-[#061B1B] ${
                              index === 0 ? 'bg-yellow-500 text-black' :
                              index === 1 ? 'bg-slate-300 text-black' :
                              index === 2 ? 'bg-amber-600 text-black' :
                              'bg-white/10 text-white'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-lg">
                              <img 
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=10B981&color=fff&bold=true&rounded=false&size=128`} 
                                alt={user.username}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                          <div>
                            <p className={`text-md font-black ${isCurrentUser ? 'text-[#10B981]' : 'text-white'} leading-none flex items-center gap-2`}>
                              {user.username}
                              {isCurrentUser && (
                                <span className="text-[8px] bg-[#10B981] text-[#061B1B] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">You</span>
                              )}
                            </p>
                            <p className="text-[10px] text-[#A0AEC0] font-bold opacity-40 mt-1.5 uppercase tracking-wider">ID: {user.telegramId}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-black ${index < 3 ? 'text-[#10B981]' : 'text-white'} leading-none`}>{value}</p>
                          <p className="text-[8px] font-black text-[#A0AEC0] uppercase mt-1.5 tracking-widest">{label}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="stats-card rounded-3xl p-6 border border-white/5 flex gap-5 items-center bg-gradient-to-br from-white/[0.03] to-transparent">
              <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 flex items-center justify-center shrink-0 border border-[#10B981]/20">
                <Users size={24} className="text-[#10B981]" />
              </div>
              <div>
                <h5 className="font-black text-xs mb-1 text-white uppercase tracking-widest">Competitive Spirit</h5>
                <p className="text-[11px] text-[#A0AEC0] leading-relaxed font-medium">
                  Be among the top 10 elites to secure exclusive high-tier reward opportunities.
                </p>
              </div>
            </div>
          </div>
        </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 py-6 pb-10 px-8 nav-blur z-50">
        <div className="max-w-xs mx-auto flex items-center justify-center">
          <NavItem icon={<Trophy />} label="Live Rankings" active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all group relative ${active ? 'text-[#10B981]' : 'text-[#A0AEC0]'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-[#10B981]/10 scale-110 shadow-lg shadow-[#10B981]/10' : 'group-hover:bg-white/5'}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-40'}`}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-pill"
          className="w-1.5 h-1.5 rounded-full bg-[#10B981] absolute -bottom-1"
        />
      )}
    </button>
  );
}
