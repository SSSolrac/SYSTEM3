import { AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { motion } from 'motion/react';

interface PointsExpiryProps {
  expiringPoints: number;
  daysUntilExpiry: number;
}

export function PointsExpiry({ expiringPoints, daysUntilExpiry }: PointsExpiryProps) {
  if (expiringPoints === 0) return null;

  const isUrgent = daysUntilExpiry <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Alert
        className={`mb-6 ${
          isUrgent
            ? 'bg-red-50 border-red-300 text-red-900'
            : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}
      >
        <AlertCircle className={`h-5 w-5 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} />
        <AlertTitle className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Points Expiring Soon
        </AlertTitle>
        <AlertDescription>
          <span className="font-bold">{expiringPoints.toLocaleString()} points</span> will expire
          in <span className="font-bold">{daysUntilExpiry} days</span>. Use them before they're
          gone!
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}

