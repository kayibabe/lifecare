// Keep dashboard KPI definitions in one place so summary cards and drill-downs
// do not silently disagree about dates or terminal workflow states.
export const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateWindowIso = (days) => new Date(Date.now() - days * 86400000).toISOString();

export const METRIC_LIMITS = { patients: 500, operational: 500, workflow: 100 };

export const isCompletedLabOrder = (order) => ["completed", "verified", "cancelled"].includes(order?.status);

export const isPendingLabOrder = (order) => !isCompletedLabOrder(order);
