// Downloads a placeholder photo for every product and uploads it to the public
// `product-images` bucket as `<product id>.jpg` (the path products.image_url expects).
//
//   node --env-file=.env.local scripts/upload-product-images.mjs
//
// Needs SUPABASE_SECRET_KEY (server-only — bypasses RLS). Safe to re-run: uploads upsert.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });
const BUCKET = "product-images";

const { data: products, error } = await supabase.from("products").select("id");
if (error) throw error;

let failed = 0;
for (const { id } of products) {
  // Seeding by product id makes each product's placeholder stable across runs.
  const res = await fetch(`https://picsum.photos/seed/${id}/800/1000.jpg`);
  if (!res.ok) {
    console.error(`✗ ${id}: download failed (${res.status})`);
    failed++;
    continue;
  }
  const body = Buffer.from(await res.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(`${id}.jpg`, body, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    console.error(`✗ ${id}: ${uploadError.message}`);
    failed++;
  } else {
    console.log(`✓ ${id}`);
  }
}

console.log(`${products.length - failed}/${products.length} images uploaded.`);
process.exit(failed ? 1 : 0);
