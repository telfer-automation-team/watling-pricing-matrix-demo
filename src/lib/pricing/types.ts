// ============================================================
// Watling Pricing Matrix — pricing engine types
// Deterministic: a quote is a pure function of the two files + rules.
// ============================================================

export type PartPrice = {
  partNo: string;
  description: string;
  cost: number; // Stock Price (dealer cost)
  retail: number; // List Price
};

export type SqtLine = {
  product: string;
  model: string;
  variant: string;
  serviceInterval: string;
  serviceDescription: string;
  labourHours: number;
  partNo: string;
  partDescription: string;
  quantity: number;
  explicitCost?: number; // manual part: use this per-unit price directly (no drum conversion)
  explicitRetail?: number;
};

export type RuleConfig = {
  lubricantDiscount: number; // e.g. 0.10  (-10%)
  otherDiscount: number; // e.g. 0.15  (-15%)
  maxLubricantDiscount: number; // cap an engineer may apply per quote
  maxOtherDiscount: number; // cap an engineer may apply per quote
  minLabourRate: number; // floor an engineer may drop labour to per quote
  labourRate: number; // charged £/hr, e.g. 65
  labourCostRate: number; // cost £/hr, e.g. 57.5
  waste: number; // £ per service, e.g. 10
  mileageDistance: number; // e.g. 50
  mileageRate: number; // £/unit distance, e.g. 1.25
  mileageTravelHours: number; // travel hours charged at labourRate, e.g. 1
  hydraulicTopupEnabled: boolean; // add a 10L HYD top-up to every service?
  hydraulicTopupPartNo: string;
  hydraulicTopupRetail: number; // e.g. 35.445
  hydraulicTopupCost: number; // e.g. 26.585
  packageInflation: number; // e.g. 0.05
  packageDiscounts: Record<number, number>; // { 2:0.05, 3:0.075, 4:0.10 }
};

export const DEFAULT_RULES: RuleConfig = {
  lubricantDiscount: 0,
  otherDiscount: 0,
  maxLubricantDiscount: 0.2,
  maxOtherDiscount: 0.25,
  minLabourRate: 57.5,
  labourRate: 65,
  labourCostRate: 57.5,
  waste: 10,
  mileageDistance: 50,
  mileageRate: 1.25,
  mileageTravelHours: 1,
  // Default OFF so quotes reproduce the current spreadsheet's answer key exactly.
  // Andy confirms whether it should be on (§ open question).
  hydraulicTopupEnabled: false,
  hydraulicTopupPartNo: "HYD-46-10L",
  hydraulicTopupRetail: 35.445,
  hydraulicTopupCost: 26.585,
  packageInflation: 0.05,
  packageDiscounts: { 2: 0.05, 3: 0.075, 4: 0.1 },
};

export type PartType = "lubricant" | "other";

export type PricedPart = {
  partNo: string;
  description: string;
  quantity: number;
  type: PartType;
  isFuel: boolean;
  perUnit: boolean; // priced per unit (no drum -> litre conversion)
  lineRetail: number;
  lineCost: number;
  manual?: boolean; // added by an admin by hand (survives re-uploads)
  priceOverridden?: boolean; // price was set/edited by an admin, not the JCB file
  note?: "backfilled-fuel" | "hydraulic-topup" | "excluded-2000hr";
};

export type ServiceAgg = {
  model: string;
  variant: string;
  serviceDescription: string;
  serviceHours: number;
  labourHours: number;
  lubRetail: number;
  lubCost: number;
  otherRetail: number;
  otherCost: number;
  parts: PricedPart[];
};

export type QuoteResult = ServiceAgg & {
  currentHours: number;
  lubCharge: number; // lubricants after discount
  otherCharge: number; // other parts after discount
  labourCharge: number;
  mileage: number;
  waste: number;
  retail: number;
  cost: number;
  profit: number;
  margin: number; // 0..1
};

export type PackageService = {
  serviceDescription: string;
  serviceHours: number;
  yearIndex: number; // 0-based
  baseRetail: number;
  inflatedRetail: number;
};

export type PackageResult = {
  services: PackageService[];
  years: number;
  subtotal: number; // sum of inflated retails
  discount: number; // 0..1
  total: number; // after package discount
};
