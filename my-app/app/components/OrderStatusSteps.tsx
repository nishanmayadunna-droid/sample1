import { statusLabel, type OrderStatus } from "@/lib/orders";
import L from "./L";

const FLOW: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];

/** Where an order is in its flow; a cancelled order shows one clear label instead. */
export default function OrderStatusSteps({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    const label = statusLabel("cancelled");
    return (
      <p className="font-mono text-sm uppercase tracking-[0.14em] text-blaze">
        <L si={label.si} en={label.en} />
      </p>
    );
  }
  const reached = FLOW.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2">
      {FLOW.map((step, index) => {
        const label = statusLabel(step);
        const done = index <= reached;
        return (
          <li
            key={step}
            aria-current={index === reached ? "step" : undefined}
            className={`font-mono text-xs uppercase tracking-[0.14em] ${done ? "text-blaze" : "text-muted"}`}
          >
            {done ? "● " : "○ "}
            <L si={label.si} en={label.en} />
          </li>
        );
      })}
    </ol>
  );
}
