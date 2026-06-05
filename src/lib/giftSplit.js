/** Creator receives 80%; platform retains 20%. */
export function calculateGiftSplit(amount) {
  const total = Math.max(0, Math.floor(Number(amount) || 0));
  const receiverAmount = Math.floor(total * 0.8);
  const platformFee = total - receiverAmount;
  return { receiverAmount, platformFee, total };
}
