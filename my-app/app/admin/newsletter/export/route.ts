import { requireAdmin } from "@/lib/auth-guards";
import { toCsv } from "@/lib/newsletter";
import { exportSubscribers } from "@/lib/newsletter-data";

export async function GET() {
  await requireAdmin("/admin/newsletter");
  const csv = toCsv(await exportSubscribers());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="subscribers.csv"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
