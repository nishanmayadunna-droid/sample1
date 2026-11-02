-- Categories, step 2 of 2 (contract). NOT YET APPLIED.
-- Apply only after the code that reads categories by slug-or-name
-- (feat/categories) is live in production; then rename this file to the
-- version apply_migration reports.
--
-- Converts every product's category from the old display name ('Outerwear')
-- to its slug ('outerwear') and adds the foreign key, so a category that
-- still has products can't be deleted at the database level either.
--
-- ONE-WAY: once applied, code from before feat/categories breaks (its filters
-- compare names, and its admin saves names, which the FK rejects). Don't roll
-- production back past feat/categories after this runs.

-- Stop with a clear list if any product points at a category that doesn't
-- exist (e.g. an orphan left by the pre-FK count/delete race). Fix those rows
-- first; the whole migration is one transaction, so nothing is half-applied.
do $$
declare
  orphans text;
begin
  select string_agg(format('%s (%s)', p.id, p.category), ', ' order by p.id)
    into orphans
    from public.products p
    where not exists (select 1 from public.categories c where c.slug = lower(p.category));
  if orphans is not null then
    raise exception 'Products with no matching category: %', orphans;
  end if;
end $$;

update public.products set category = lower(category);

alter table public.products
  add constraint products_category_fkey
  foreign key (category) references public.categories (slug) on delete restrict;
