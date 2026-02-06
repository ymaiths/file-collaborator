export const SYSTEM_CATEGORIES = [
  "Solar Panel",
  "Inverter",
  "AC Box",
  "DC Box",
  "PV Mounting Structure",
  "Cable & Connector",
  "Operation & Maintenance",
  "Service",
  "Optimizer",
  "Support Inverter",
  "Electrical Management"
] as const;

export const isSystemCategory = (categoryName: string): boolean => {
  return SYSTEM_CATEGORIES.some(
    (sys) => sys.toLowerCase() === categoryName.toLowerCase().trim()
  );
};