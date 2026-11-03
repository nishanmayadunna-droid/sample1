"use client";

import { useState } from "react";
import { MAX_RULES } from "@/lib/promotion-form";
import type { PromotionRule, RuleKind, RuleScope } from "@/lib/promotions";

export type PickerProduct = { id: string; name: string };
export type PickerCategory = { slug: string; name: string };

type Row = {
  key: number;
  kind: RuleKind;
  value: string;
  scope: RuleScope;
  categorySlugs: string[];
  productIds: string[];
  min: string;
};

const KIND_LABELS: Record<RuleKind, string> = {
  free_shipping: "Free shipping",
  percent_off: "% off each item",
  amount_off_item: "Rs off each item",
  amount_off_order: "Rs off the order (once)",
};

const rupees = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");

function toRow(rule: PromotionRule, key: number): Row {
  return {
    key,
    kind: rule.kind,
    value: rule.kind === "percent_off" ? String(rule.value) : rule.kind === "free_shipping" ? "" : rupees(rule.value),
    scope: rule.scope,
    categorySlugs: rule.categorySlugs,
    productIds: rule.productIds,
    min: rule.minSubtotal > 0 ? rupees(rule.minSubtotal) : "",
  };
}

const inputClass = "rounded-md border border-line bg-bg px-3 py-2 outline-none focus:border-ink";

function ProductPicker({
  products,
  selected,
  onChange,
}: {
  products: PickerProduct[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = products.filter((p) => selected.includes(p.id) || !q || p.name.toLowerCase().includes(q) || p.id.includes(q));
  const missing = selected.filter((id) => !products.some((p) => p.id === id));

  return (
    <div className="mt-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products"
        className={`${inputClass} w-full`}
      />
      <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-line p-2">
        {shown.map((p) => (
          <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
            />
            {p.name} <span className="font-mono text-xs text-muted">{p.id}</span>
          </label>
        ))}
        {missing.map((id) => (
          <label key={id} className="flex items-center gap-2 py-1 text-sm text-blaze">
            <input type="checkbox" checked onChange={() => onChange(selected.filter((x) => x !== id))} />
            {id} (no longer exists)
          </label>
        ))}
      </div>
    </div>
  );
}

/** The promotion's rules, edited on the client and submitted as one JSON field. */
export default function RulesEditor({
  initial,
  categories,
  products,
}: {
  initial: PromotionRule[];
  categories: PickerCategory[];
  products: PickerProduct[];
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const [nextKey, setNextKey] = useState(initial.length);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey, kind: "percent_off", value: "", scope: "all", categorySlugs: [], productIds: [], min: "" },
    ]);
    setNextKey((k) => k + 1);
  }

  return (
    <div>
      <input
        type="hidden"
        name="rules"
        value={JSON.stringify(
          rows.map((row) => ({
            kind: row.kind,
            value: row.value,
            scope: row.scope,
            categorySlugs: row.categorySlugs,
            productIds: row.productIds,
            min: row.min,
          })),
        )}
      />
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-muted">No rules yet. A promotion without rules only shows its banner.</p>
      )}
      <ol className="mt-3 flex flex-col gap-4">
        {rows.map((row, i) => (
          <li key={row.key} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-muted">Rule {i + 1}</span>
              <select
                value={row.kind}
                onChange={(e) => update(row.key, { kind: e.target.value as RuleKind })}
                aria-label={`Rule ${i + 1} type`}
                className={inputClass}
              >
                {(Object.keys(KIND_LABELS) as RuleKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
              {row.kind !== "free_shipping" && (
                <label className="flex items-center gap-2 text-sm">
                  {row.kind === "percent_off" ? "%" : "Rs"}
                  <input
                    value={row.value}
                    onChange={(e) => update(row.key, { value: e.target.value })}
                    inputMode="decimal"
                    aria-label={`Rule ${i + 1} amount`}
                    className={`${inputClass} w-28`}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                className="ml-auto text-sm text-muted hover:text-blaze"
                aria-label={`Remove rule ${i + 1}`}
              >
                ✕ Remove
              </button>
            </div>

            <fieldset className="mt-3">
              <legend className="text-sm text-muted">Applies to</legend>
              <div className="mt-1 flex flex-wrap gap-4 text-sm">
                {(["all", "categories", "products"] as const).map((scope) => (
                  <label key={scope} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`scope-${row.key}`}
                      checked={row.scope === scope}
                      onChange={() => update(row.key, { scope })}
                    />
                    {scope === "all" ? "Every product" : scope === "categories" ? "Categories" : "Products"}
                  </label>
                ))}
              </div>
              {row.scope === "categories" && (
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {categories.map((c) => (
                    <label key={c.slug} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.categorySlugs.includes(c.slug)}
                        onChange={(e) =>
                          update(row.key, {
                            categorySlugs: e.target.checked
                              ? [...row.categorySlugs, c.slug]
                              : row.categorySlugs.filter((s) => s !== c.slug),
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
              {row.scope === "products" && (
                <ProductPicker
                  products={products}
                  selected={row.productIds}
                  onChange={(productIds) => update(row.key, { productIds })}
                />
              )}
            </fieldset>

            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              Only when these items total at least Rs
              <input
                value={row.min}
                onChange={(e) => update(row.key, { min: e.target.value })}
                inputMode="decimal"
                placeholder="optional"
                aria-label={`Rule ${i + 1} minimum`}
                className={`${inputClass} w-32`}
              />
            </label>
          </li>
        ))}
      </ol>
      {rows.length < MAX_RULES && (
        <button
          type="button"
          onClick={addRow}
          className="mt-4 rounded-full border border-line px-4 py-2 text-sm hover:border-ink"
        >
          + Add rule
        </button>
      )}
    </div>
  );
}
