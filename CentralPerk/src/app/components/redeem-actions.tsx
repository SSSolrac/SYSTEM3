import { Gift, ShoppingBag, Ticket } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface RedeemActionsProps {
  availablePoints: number;
}

export function RedeemActions({ availablePoints }: RedeemActionsProps) {
  const handleRedeem = (option: string) => {
    toast.success(`Redeem ${option} feature coming soon!`, {
      description: `You have ${availablePoints.toLocaleString()} points available.`,
    });
  };

  const redeemOptions = [
    {
      icon: Gift,
      title: 'Gift Cards',
      description: 'Redeem points for popular gift cards',
      minPoints: 500,
      color: 'text-[#1A2B47]',
      bgColor: 'bg-[#e9edf5]',
    },
    {
      icon: ShoppingBag,
      title: 'Shopping Vouchers',
      description: 'Get vouchers for your favorite stores',
      minPoints: 1000,
      color: 'text-[#1A2B47]',
      bgColor: 'bg-[#e9edf5]',
    },
    {
      icon: Ticket,
      title: 'Event Tickets',
      description: 'Access to exclusive events',
      minPoints: 2000,
      color: 'text-[#1A2B47]',
      bgColor: 'bg-[#e9edf5]',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <Card className="shadow-md mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#1A2B47]" />
            Redeem Your Points
          </CardTitle>
          <CardDescription>
            Choose from a variety of rewards and experiences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {redeemOptions.map((option, index) => {
              const Icon = option.icon;
              const canRedeem = availablePoints >= option.minPoints;

              return (
                <motion.div
                  key={option.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  className={`border rounded-lg p-4 ${
                    canRedeem
                      ? 'hover:border-[#1A2B47] hover:shadow-md cursor-pointer'
                      : 'opacity-60 cursor-not-allowed'
                  } transition-all`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${option.bgColor} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${option.color}`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{option.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Min. {option.minPoints.toLocaleString()} pts
                    </span>
                    <Button
                      size="sm"
                      disabled={!canRedeem}
                      onClick={() => handleRedeem(option.title)}
                      className={
                        canRedeem
                          ? 'bg-gradient-to-r from-[#1A2B47] to-[#1A2B47] hover:from-[#1A2B47] hover:to-[#1A2B47] text-white'
                          : ''
                      }
                    >
                      Redeem
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

