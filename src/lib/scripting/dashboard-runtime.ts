import dashboard from "./default-dashboard.js";
import { createDashboardApi, type DashboardWidget } from "./dashboard-api";

// The default script is trusted, bundled application code. Do not load
// arbitrary filesystem or uploaded JS into this process without isolation.
export async function getDashboardWidgets(): Promise<DashboardWidget[]> {
  const { ui, widgets } = createDashboardApi();
  await dashboard({ ui });
  return widgets;
}
