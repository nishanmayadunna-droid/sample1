"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { analyticsUrl } from "@/lib/analytics-filter";

// Private pages are never reported, and `token` query values never leave the site.
const beforeSend: BeforeSend = (event) => {
  const url = analyticsUrl(event.url);
  return url === null ? null : { ...event, url };
};

export default function AnalyticsGate() {
  return (
    <>
      <Analytics beforeSend={beforeSend} />
      <SpeedInsights
        beforeSend={(event) => {
          const url = analyticsUrl(event.url);
          return url === null ? null : { ...event, url };
        }}
      />
    </>
  );
}
