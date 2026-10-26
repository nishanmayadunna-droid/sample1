-- Categories, step 2 of 2 (contract). NOT YET APPLIED.
-- Apply only after the code that reads categories by slug-or-name
-- (feat/categories) is live in production; then rename this file to the
-- version apply_migration reports.
--
-- Converts every product's category from the old display name ('Outerwear')
-- to its slug ('outerwear') and adds the foreign key, so a category that
-- still has products can't be deleted at the database level either.

update public.products set category = lower(category);

alter table public.products
  add constraint products_category_fkey
  foreign key (category) references public.categories (slug) on delete restrict;
