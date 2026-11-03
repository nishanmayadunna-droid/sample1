-- Tighten public access to reviews (follow-up to 20261103180000). Run by the
-- owner in the SQL editor. The shop code does not depend on it, so it can be
-- applied before or after the deploy.
--
-- 1. The public key may read only the columns the shop shows, not user_id (which
--    would link one customer's reviews across products).
-- 2. Reviews of hidden (unpublished) products are not public either.

revoke select on table public.reviews from anon, authenticated;
grant select (id, product_id, author_name, rating, body, status, created_at)
  on table public.reviews to anon, authenticated;

drop policy "Approved reviews are public" on public.reviews;

create policy "Approved reviews of published products are public"
  on public.reviews for select
  to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.products p
      where p.id = reviews.product_id and p.published
    )
  );
