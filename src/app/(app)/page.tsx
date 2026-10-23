import { ActivityForm } from "@/features/activities/components/ActivityForm";
import { getLatestActivityEnd } from "@/features/activities/queries";
import { getActivityFormDefaults } from "@/features/activities/time";
import { getEnv } from "@/lib/env";

// Defaults depend on the current time and the latest activity: never cache.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const timeZone = getEnv().APP_TIMEZONE;
  const latestEnd = await getLatestActivityEnd();
  const initialValues = getActivityFormDefaults(latestEnd, timeZone, new Date());

  return (
    // Bottom padding reserves the space of the fixed Save bar.
    <div className="flex flex-col gap-6 pb-24">
      <h1 className="sr-only">Activities Tracking</h1>
      <ActivityForm initialValues={initialValues} timeZone={timeZone} />

      {/* Phase 6: recent activities (latest 10) go here, below the form. */}
    </div>
  );
}
