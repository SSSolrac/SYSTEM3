import { useEffect, useMemo, useState } from "react";
import { Award, ShoppingBag, Gift, Store, Truck } from "lucide-react";
import type { Reward } from "../../types/loyalty";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Switch } from "../../components/ui/switch";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { toast } from "sonner";
import { useOutletContext } from "react-router-dom";
import type { AppOutletContext } from "../../types/app-context";
import { cn } from "../../components/ui/utils";
import { loadRewardsCatalog, redeemMemberPoints } from "../../lib/loyalty-supabase";

const rewardImages = [
  "https://images.unsplash.com/photo-1657048167114-0942f3a2dc93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1751151856149-5ebf1d21586a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1680381724318-c8ac9fe3a484?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1738682585466-c287db5404de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1561766858-62033ae40ec3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1666447616947-cd26838cb88b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1637910116483-7efcc9480847?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  "https://images.unsplash.com/photo-1683888046273-38c106471115?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
];

type RedemptionMethod = "in-store" | "online";

export default function Rewards() {
  const { user, refreshUser } = useOutletContext<AppOutletContext>();
  const [catalog, setCatalog] = useState<Reward[]>([]);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [redemptionMethod, setRedemptionMethod] = useState<RedemptionMethod>("in-store");
  const [usePoints, setUsePoints] = useState(false);
  const [autoApplyAtCheckout, setAutoApplyAtCheckout] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState("");
  const [pointsToUse, setPointsToUse] = useState("");
  const [giftEmail, setGiftEmail] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [redeemSearch, setRedeemSearch] = useState("");
  const [reservedRewards, setReservedRewards] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRewardsCatalog()
      .then((rows) => setCatalog(rows))
      .catch(() => setCatalog([]));
  }, []);

  const filteredRewards = useMemo(() => catalog.filter((reward) => reward.available), [catalog]);
  const redeemedHistory = useMemo(() => {
    const keyword = redeemSearch.trim().toLowerCase();
    return user.transactions
      .filter((tx) => tx.type === "redeemed")
      .filter((tx) => (keyword ? tx.description.toLowerCase().includes(keyword) : true));
  }, [user.transactions, redeemSearch]);

  const spendPoints = async (points: number, description: string, category = "Reward", type: "redeemed" | "gifted" = "redeemed") => {
    await redeemMemberPoints({
      memberIdentifier: user.memberId,
      fallbackEmail: user.email,
      points,
      transactionType: type === "gifted" ? "GIFT" : "REDEEM",
      reason: `${description}${category ? ` [${category}]` : ""}${type === "gifted" ? " (gifted)" : ""}`,
    });
    await refreshUser();
  };

  const handleReserve = (reward: Reward) => {
    setSelectedReward(reward);
    setReserveDialogOpen(true);
  };

  const confirmReserve = () => {
    if (!selectedReward) return;
    if (reservedRewards.includes(selectedReward.id)) {
      toast.info("This reward is already reserved.");
      setReserveDialogOpen(false);
      return;
    }
    setReservedRewards((prev) => [...prev, selectedReward.id]);
    toast.success("Reward reserved!", { description: `${selectedReward.name} reserved for 24 hours` });
    setReserveDialogOpen(false);
  };

  const handleRedeem = (reward: Reward) => {
    setSelectedReward(reward);
    setRedeemDialogOpen(true);
  };

  const confirmRedeem = async () => {
    if (!selectedReward) return;
    try {
      setSaving(true);
      await spendPoints(selectedReward.pointsCost, `${selectedReward.name} Redemption`);
      setReservedRewards((prev) => prev.filter((id) => id !== selectedReward.id));
      toast.success("Reward redeemed!", {
        description: redemptionMethod === "online" ? `${selectedReward.name} will be delivered.` : `Show this confirmation at the counter for ${selectedReward.name}.`,
      });
      setRedeemDialogOpen(false);
      setRedemptionMethod("in-store");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Redeem failed");
    } finally {
      setSaving(false);
    }
  };

  const handleGift = (reward: Reward) => {
    setSelectedReward(reward);
    setGiftDialogOpen(true);
  };

  const confirmGift = async () => {
    if (!selectedReward || !giftEmail) return;
    try {
      setSaving(true);
      await spendPoints(selectedReward.pointsCost, `Gifted: ${selectedReward.name} to ${giftEmail}`, "Transfer", "gifted");
      toast.success("Points gifted!", { description: `${selectedReward.pointsCost} points sent to ${giftEmail}` });
      setGiftDialogOpen(false);
      setGiftEmail("");
      setGiftMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gift failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePartialPayment = async () => {
    const points = parseInt(pointsToUse, 10);
    if (!Number.isFinite(points) || points <= 0) {
      toast.error("Enter a valid point amount.");
      return;
    }

    try {
      setSaving(true);
      await spendPoints(points, "Partial payment applied", "Checkout");
      toast.success(`${points} points applied!`);
      setUsePoints(false);
      setPointsToUse("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Apply failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoApplyCheckout = async () => {
    const subtotal = parseFloat(checkoutAmount);
    if (!subtotal || subtotal <= 0) {
      toast.error("Enter a valid checkout amount.");
      return;
    }

    const maxApplicablePoints = Math.min(user.points, Math.floor(subtotal * 100));
    if (maxApplicablePoints <= 0) {
      toast.error("No points available to apply.");
      return;
    }

    try {
      setSaving(true);
      await spendPoints(maxApplicablePoints, `Auto apply checkout ($${subtotal.toFixed(2)})`, "Checkout");
      const finalAmount = Math.max(0, subtotal - maxApplicablePoints / 100);
      toast.success("Points auto-applied at checkout!", {
        description: `${maxApplicablePoints} points used. New payable total: $${finalAmount.toFixed(2)}`,
      });
      setCheckoutAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Auto apply failed");
    } finally {
      setSaving(false);
    }
  };


  const renderRewardCard = (reward: Reward, imageIndex: number) => {
    const isReserved = reservedRewards.includes(reward.id);
    const canAfford = user.points >= reward.pointsCost;
    const imageSrc = reward.imageUrl || rewardImages[imageIndex % rewardImages.length];

    return (
      <Card key={reward.id} className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative">
          <ImageWithFallback src={imageSrc} alt={reward.name} className="w-full h-48 object-cover" />
          {isReserved && <Badge className="absolute top-3 right-3 bg-sky-600 text-white">Reserved</Badge>}
        </div>

        <div className="p-6">
          <h3 className="font-semibold text-gray-900 mb-2">{reward.name}</h3>
          <p className="text-sm text-gray-600 mb-4">{reward.description}</p>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-sky-600">{reward.pointsCost}</span><span className="text-sm text-gray-500">points</span></div>
            <Badge variant="outline" className="capitalize">{reward.category}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1 min-w-[120px] bg-[#1A2B47] hover:brightness-110 text-white" onClick={() => handleRedeem(reward)} disabled={saving}>{isReserved ? "Redeem Now" : "Redeem"}</Button>
            {!isReserved && canAfford && <Button variant="outline" className="border-gray-200 text-[#1A2B47] hover:bg-[#e9edf5] hover:text-[#1A2B47]" onClick={() => handleReserve(reward)}>Reserve</Button>}
            <Button variant="outline" className="border-gray-200 text-[#1A2B47] hover:bg-[#e9edf5] hover:text-[#1A2B47]" size="icon" onClick={() => handleGift(reward)} disabled={saving}><Gift className="w-4 h-4" /></Button>
          </div>

          {!canAfford && <p className="text-xs text-orange-600 mt-2">Need {reward.pointsCost - user.points} more points</p>}
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
        <p className="text-gray-500 mt-1">Redeem your points for exclusive rewards</p>
      </div>

      <Card className="p-6 bg-gradient-to-br from-[#1A2B47] to-[#1A2B47] border-0 text-white">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-white/90 text-sm font-medium">Available Points</p><h2 className="text-4xl font-bold mt-2 text-white">{user.points.toLocaleString()}</h2><p className="text-white/85 text-sm mt-1">{user.pendingPoints > 0 && `+${user.pendingPoints} pending`}</p></div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center"><Award className="w-8 h-8" /></div>
        </div>
      </Card>

      <Card className="p-6 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">Use Points as Partial Payment</h3>
            <p className="text-sm text-gray-600 mb-4">Apply your points to reduce the cost of any purchase (1 point = $0.01)</p>
            {usePoints && (
              <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                <Input type="number" placeholder="Enter points" value={pointsToUse} onChange={(e) => setPointsToUse(e.target.value)} max={user.points} />
                <Button className="bg-[#00A3AD] hover:brightness-110 text-white" onClick={handlePartialPayment} disabled={saving || !pointsToUse || parseInt(pointsToUse, 10) <= 0}>Apply</Button>
              </div>
            )}
          </div>
          <Button variant={usePoints ? "outline" : "default"} className={cn("w-full sm:w-auto", !usePoints ? "bg-[#1A2B47] hover:brightness-110 text-white" : "")} onClick={() => setUsePoints((prev) => !prev)}>{usePoints ? "Cancel" : "Use Points"}</Button>
        </div>
      </Card>

      <Card className="p-6 border-[#00A3AD]/25 bg-[#e6f8fa]">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Apply Points Automatically at Checkout</h3>
            <p className="text-sm text-gray-600 mb-3">Enable auto-apply to use the maximum available points for your current checkout amount.</p>
            {autoApplyAtCheckout && (
              <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <Input type="number" step="0.01" min="0" placeholder="Checkout amount (e.g. 18.50)" value={checkoutAmount} onChange={(e) => setCheckoutAmount(e.target.value)} />
                <Button className="bg-[#1A2B47] hover:brightness-110 text-white" onClick={handleAutoApplyCheckout} disabled={saving}>Auto Apply</Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-1"><Label htmlFor="auto-apply">Auto Apply</Label><Switch id="auto-apply" checked={autoApplyAtCheckout} onCheckedChange={setAutoApplyAtCheckout} /></div>
        </div>
      </Card>

      {reservedRewards.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><ShoppingBag className="w-5 h-5" />Reserved Rewards ({reservedRewards.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {catalog.filter((reward) => reservedRewards.includes(reward.id)).map((reward, index) => (
              <div key={reward.id} className="flex items-center gap-4 p-4 rounded-xl border-2 border-sky-200 bg-sky-50/50">
                <ImageWithFallback src={rewardImages[index]} alt={reward.name} className="w-20 h-20 rounded-lg object-cover" />
                <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 truncate">{reward.name}</p><p className="text-sm text-gray-600">{reward.pointsCost} points</p><Badge className="mt-1 bg-sky-100 text-sky-700">Reserved</Badge></div>
                <Button size="sm" onClick={() => handleRedeem(reward)} className="bg-[#1A2B47] hover:brightness-110 text-white">Redeem</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 border-orange-200 bg-orange-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900">Redeemed History</h3>
          <Input value={redeemSearch} onChange={(e) => setRedeemSearch(e.target.value)} placeholder="Search redeemed item..." className="sm:w-72 bg-white" />
        </div>
        {redeemedHistory.length === 0 ? (
          <p className="text-sm text-gray-600">No redeemed items found.</p>
        ) : (
          <div className="space-y-3">
            {redeemedHistory.slice(0, 20).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white border border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">{tx.description}</p>
                  <p className="text-sm text-gray-600">{new Date(tx.date).toLocaleDateString()} | Balance after redeem: {tx.balance.toLocaleString()} pts</p>
                </div>
                <Badge className="bg-orange-100 text-orange-700 border-orange-200" variant="outline">-{tx.points} pts</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Rewards</TabsTrigger>
          <TabsTrigger value="beverage">Beverages</TabsTrigger>
          <TabsTrigger value="food">Food</TabsTrigger>
          <TabsTrigger value="merchandise">Merchandise</TabsTrigger>
          <TabsTrigger value="voucher">Vouchers</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredRewards.map((reward, index) => renderRewardCard(reward, index))}</div></TabsContent>
        {["beverage", "food", "merchandise", "voucher"].map((category) => (
          <TabsContent key={category} value={category} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredRewards.filter((reward) => reward.category === category).map((reward) => { const imageIndex = catalog.findIndex((item) => item.id === reward.id); return renderRewardCard(reward, imageIndex); })}</div></TabsContent>
        ))}
      </Tabs>

      {filteredRewards.length === 0 && (
        <Card className="p-6 border-dashed border-gray-300">
          <p className="text-sm text-gray-600">
            No rewards found in database. Add rows to <code>rewards_catalog</code> to show redeemable items.
          </p>
        </Card>
      )}

      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent className="sm:max-w-lg !bg-white !text-gray-900 border border-gray-200 shadow-2xl"><DialogHeader><DialogTitle className="text-gray-900">Redeem Reward</DialogTitle><DialogDescription className="text-gray-500">Choose how you'd like to receive your reward</DialogDescription></DialogHeader>
          {selectedReward && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50"><div className="flex-1"><p className="font-semibold text-gray-900">{selectedReward.name}</p><p className="text-sm text-gray-600">{selectedReward.description}</p></div><div className="text-right"><p className="text-4xl font-bold leading-none text-[#1A2B47]">{selectedReward.pointsCost}</p><p className="text-xs text-gray-500 mt-1">points</p></div></div>
              <div className="space-y-3"><Label className="text-gray-900">Redemption Method</Label><div className="grid grid-cols-2 gap-3"><button className={`p-4 rounded-2xl border transition-all ${redemptionMethod === "in-store" ? "border-[#1A2B47] bg-[#e9f2f8]" : "border-gray-200 bg-white hover:bg-gray-50"}`} onClick={() => setRedemptionMethod("in-store")}><Store className={`w-6 h-6 mx-auto mb-2 ${redemptionMethod === "in-store" ? "text-[#1A2B47]" : "text-gray-400"}`} /><p className="font-medium text-sm text-gray-900">In-Store</p><p className="text-xs text-gray-500 mt-1">Pick up at counter</p></button><button className={`p-4 rounded-2xl border transition-all ${redemptionMethod === "online" ? "border-[#1A2B47] bg-[#e9f2f8]" : "border-gray-200 bg-white hover:bg-gray-50"}`} onClick={() => setRedemptionMethod("online")}><Truck className={`w-6 h-6 mx-auto mb-2 ${redemptionMethod === "online" ? "text-[#1A2B47]" : "text-gray-400"}`} /><p className="font-medium text-sm text-gray-900">Delivery</p><p className="text-xs text-gray-500 mt-1">Redeem online for delivery</p></button></div></div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="h-10 border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              onClick={() => setRedeemDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-10 bg-[#1A2B47] hover:brightness-110 text-white"
              onClick={confirmRedeem}
              disabled={saving}
            >
              Confirm Redemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
        <DialogContent className="sm:max-w-md !bg-white !text-gray-900 border border-gray-200 shadow-2xl"><DialogHeader><DialogTitle className="text-gray-900">Gift Points to Friend</DialogTitle><DialogDescription className="text-gray-500">Share points with another member</DialogDescription></DialogHeader>
          {selectedReward && (
            <div className="space-y-4 py-4"><div className="p-4 rounded-lg bg-purple-50 border border-purple-200"><p className="text-sm text-gray-900 mb-1"><strong>Sending:</strong> {selectedReward.pointsCost} points</p><p className="text-sm text-gray-600">For: {selectedReward.name}</p></div><div><Label htmlFor="gift-email">Recipient Email</Label><Input id="gift-email" type="email" placeholder="friend@email.com" value={giftEmail} onChange={(e) => setGiftEmail(e.target.value)} className="mt-2" /></div><div><Label htmlFor="gift-message">Personal Message (Optional)</Label><Input id="gift-message" placeholder="Enjoy your reward" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} className="mt-2" /></div></div>
          )}
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="h-10 border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              onClick={() => setGiftDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button className="h-10 bg-purple-600 hover:bg-purple-700 text-white" onClick={confirmGift} disabled={!giftEmail || saving}>Send Gift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reserveDialogOpen} onOpenChange={setReserveDialogOpen}>
        <DialogContent className="sm:max-w-md !bg-white !text-gray-900 border border-gray-200 shadow-2xl"><DialogHeader><DialogTitle className="text-gray-900">Reserve Reward</DialogTitle><DialogDescription className="text-gray-500">Reserve this reward for 24 hours without using points yet</DialogDescription></DialogHeader>
          {selectedReward && (
            <div className="space-y-4 py-4"><div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50"><div className="flex-1"><p className="font-semibold text-gray-900">{selectedReward.name}</p><p className="text-sm text-gray-600">{selectedReward.description}</p></div><div className="text-right"><p className="text-2xl font-bold text-[#1A2B47]">{selectedReward.pointsCost}</p><p className="text-xs text-gray-500">points</p></div></div></div>
          )}
          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="h-10 border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              onClick={() => setReserveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button className="h-10 bg-[#1A2B47] hover:brightness-110 text-white" onClick={confirmReserve}>Reserve Reward</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





