import L from "./L";

/** Five stars filled to `value` (a whole number or an average). Server-safe. */
export default function Stars({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span aria-hidden="true" className="text-blaze">
        {"★".repeat(filled)}
        <span className="text-line">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="sr-only">
        <L si={`තරු 5න් ${value}`} en={`${value} out of 5 stars`} />
      </span>
    </span>
  );
}
