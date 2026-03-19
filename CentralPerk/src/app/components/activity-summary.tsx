import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { motion } from 'motion/react';

interface ActivitySummaryProps {
  earnedThisMonth: number;
  redeemedThisMonth: number;
  totalTransactions: number;
}

export function ActivitySummary({
  earnedThisMonth,
  redeemedThisMonth,
  totalTransactions,
}: ActivitySummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Earned This Month</p>
                <p className="text-2xl font-bold text-[#1A2B47]">
                  +{earnedThisMonth.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#e9edf5] flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#1A2B47]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Redeemed This Month</p>
                <p className="text-2xl font-bold text-red-600">
                  -{redeemedThisMonth.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-[#1A2B47]">
                  {totalTransactions}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#e9edf5] flex items-center justify-center">
                <Activity className="w-6 h-6 text-[#1A2B47]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

