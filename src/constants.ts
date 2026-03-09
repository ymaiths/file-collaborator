export const SYSTEM_CATEGORIES = [
  "Standard Solar Panel",
  "Standard Inverter",
  "Standard AC Box",
  "Standard DC Box",
  "Standard PV Mounting Structure",
  "Standard Cable & Connector",
  "Standard Operation",
  "Standard Service",
  "Standard Optimizer",
  "Standard Support Inverter",
  "Standard Electrical Management"
] as const;

export const isSystemCategory = (categoryName: string): boolean => {
  return SYSTEM_CATEGORIES.some(
    (sys) => sys.toLowerCase() === categoryName.toLowerCase().trim()
  );
};