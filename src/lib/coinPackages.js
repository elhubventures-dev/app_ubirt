/** Coin packs for wallet purchases. Amounts are in major currency units (e.g. NGN). */
export const COIN_PACKAGES = [
  { id: "pack1", coins: 100, amount: 1500, priceLabel: "₦1,500" },
  { id: "pack2", coins: 500, amount: 7500, priceLabel: "₦7,500", popular: true },
  { id: "pack3", coins: 1200, amount: 15000, priceLabel: "₦15,000" },
  { id: "pack4", coins: 6500, amount: 75000, priceLabel: "₦75,000" },
];

export const PAYMENT_CURRENCY = import.meta.env.VITE_PAYMENT_CURRENCY || "NGN";
