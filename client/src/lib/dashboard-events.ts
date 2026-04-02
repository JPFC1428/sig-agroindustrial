const DASHBOARD_DATA_CHANGED_EVENT = "sig:dashboard-data-changed";

export function notifyDashboardDataChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(DASHBOARD_DATA_CHANGED_EVENT));
}

export function subscribeDashboardDataChanged(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => {
    listener();
  };

  window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, handler);

  return () => {
    window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, handler);
  };
}
