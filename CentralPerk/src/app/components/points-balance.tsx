import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { motion } from 'motion/react';

interface PointsBalanceProps {
  points: number;
  tier: string;
}

export function PointsBalance({ points, tier }: PointsBalanceProps) {
  const [displayPoints, setDisplayPoints] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 1500;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentPoints = Math.floor(easeOutQuart * points);

      setDisplayPoints(currentPoints);

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [points]);

  const getTierProgress = () => {
    const tiers = {
      bronze: { min: 0, max: 250, next: 'Silver' },
      silver: { min: 250, max: 750, next: 'Gold' },
    };

    const currentTier = tier.toLowerCase();
    const tierData = tiers[currentTier as keyof typeof tiers];
    if (!tierData) return null;

    const progress = ((points - tierData.min) / (tierData.max - tierData.min)) * 100;
    const remaining = tierData.max - points;

    return {
      progress: Math.min(progress, 100),
      remaining,
      nextTier: tierData.next,
      max: tierData.max,
    };
  };

  const tierProgress = getTierProgress();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="shadow-lg bg-gradient-to-br from-[#1A2B47] to-[#1A2B47] text-white overflow-hidden relative h-full">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full -ml-24 -mb-24" />
        </div>

        <CardHeader className="relative z-10">
          <CardTitle className="flex items-center gap-2 text-white">
            <Wallet className="w-6 h-6" />
            Current Points Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-6">
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="w-8 h-8" />
            </div>
            <motion.div
              key={displayPoints}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-5xl font-bold mb-2"
            >
              {displayPoints.toLocaleString()}
            </motion.div>
            <p className="text-cyan-100 text-lg">Available Points</p>
          </div>

          {tierProgress && tierProgress.remaining > 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Next Tier: {tierProgress.nextTier}
                </span>
                <span>{tierProgress.remaining.toLocaleString()} points to go</span>
              </div>
              <Progress
                value={tierProgress.progress}
                className="h-2 bg-white/20"
                indicatorClassName="bg-white"
              />
              <p className="text-xs text-cyan-100">
                {tierProgress.progress.toFixed(1)}% toward {tierProgress.nextTier} tier
              </p>
            </div>
          )}

          {tierProgress && tierProgress.remaining <= 0 && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">You've reached the maximum tier!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}


