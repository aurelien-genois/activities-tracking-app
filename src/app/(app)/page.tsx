import { ActivityForm } from "@/features/activities/components/ActivityForm";
import { RecentList } from "@/features/activities/components/RecentList";
import { getLatestActivityEnd, getRecentActivities } from "@/features/activities/queries";
import { getActivityFormDefaults } from "@/features/activities/time";
import { getEnv } from "@/lib/env";

// Defaults depend on the current time and the latest activity: never cache.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const timeZone = getEnv().APP_TIMEZONE;
  const [latestEnd, recentActivities] = await Promise.all([
    getLatestActivityEnd(),
    getRecentActivities(),
  ]);
  const now = new Date();
  const initialValues = getActivityFormDefaults(latestEnd, timeZone, now);

  return (
    // Bottom padding reserves the space of the fixed Save bar (incl. the safe area).
    <div className="flex flex-col gap-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <h1 className="sr-only">Activities Tracking</h1>
      <ActivityForm initialValues={initialValues} timeZone={timeZone} />
      <RecentList activities={recentActivities} timeZone={timeZone} now={now} />
    </div>
  );
}
