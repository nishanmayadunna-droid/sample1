-- Maya chat assistant (guided now, AI engine ready but off).
-- Additive: nothing reads these tables until the chat is switched on in /admin/chat.
-- chat_settings and chat_topics are public SELECT (they are what customers see anyway);
-- writes go through the secret key. chat_usage is private.

create table public.chat_settings (
  id                 boolean primary key default true check (id),
  enabled            boolean not null default false,
  engine             text not null default 'guided' check (engine in ('guided', 'ai')),
  assistant_name     text not null default 'Maya' check (char_length(assistant_name) between 1 and 40),
  mascot_path        text check (mascot_path is null or mascot_path ~ '^[0-9]{10,16}\.(png|webp|jpg|jpeg)$'),
  greeting_si        text not null default '' check (char_length(greeting_si) <= 120),
  greeting_en        text not null default '' check (char_length(greeting_en) <= 120),
  first_message_si   text not null default '' check (char_length(first_message_si) <= 300),
  first_message_en   text not null default '' check (char_length(first_message_en) <= 300),
  accent             text not null default '#d9531e' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  show_bubble        boolean not null default true,
  trust_si           text not null default '' check (char_length(trust_si) <= 600),
  trust_en           text not null default '' check (char_length(trust_en) <= 600),
  ai_model           text not null default 'claude-haiku-5-5' check (char_length(ai_model) between 1 and 80),
  ai_guest_per_minute  integer not null default 5    check (ai_guest_per_minute between 1 and 100000),
  ai_guest_per_day     integer not null default 30   check (ai_guest_per_day between 1 and 100000),
  ai_user_per_minute   integer not null default 10   check (ai_user_per_minute between 1 and 100000),
  ai_user_per_day      integer not null default 100  check (ai_user_per_day between 1 and 100000),
  ai_shop_daily_cap    integer not null default 2000 check (ai_shop_daily_cap between 1 and 100000),
  ai_max_message_chars integer not null default 500  check (ai_max_message_chars between 50 and 2000),
  ai_max_reply_tokens  integer not null default 400  check (ai_max_reply_tokens between 50 and 2000),
  updated_at         timestamptz not null default now()
);
insert into public.chat_settings default values;

alter table public.chat_settings enable row level security;
create policy "Chat settings are publicly readable"
  on public.chat_settings for select to anon, authenticated using (true);
revoke all on table public.chat_settings from anon, authenticated;
grant select on table public.chat_settings to anon, authenticated;

-- Empty table = the built-in default topics apply (lib/chat-defaults.ts).
create table public.chat_topics (
  id          text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  title_si    text not null check (char_length(title_si) between 1 and 80),
  title_en    text not null check (char_length(title_en) between 1 and 80),
  keywords    text[] not null check (cardinality(keywords) between 1 and 40),
  answer_si   text not null check (char_length(answer_si) between 1 and 600),
  answer_en   text not null check (char_length(answer_en) between 1 and 600),
  links       jsonb not null default '[]'::jsonb
              check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 4),
  follow_ups  text[] not null default '{}' check (cardinality(follow_ups) <= 4),
  requires    text check (requires is null or requires in ('card', 'advance', 'sms', 'email', 'push', 'points')),
  sort_order  integer not null default 0 check (sort_order between 0 and 100000),
  visible     boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.chat_topics enable row level security;
create policy "Chat topics are publicly readable"
  on public.chat_topics for select to anon, authenticated using (true);
revoke all on table public.chat_topics from anon, authenticated;
grant select on table public.chat_topics to anon, authenticated;

-- Mascot pictures (public, PNG/WebP/JPEG, 1 MB). Uploads use signed URLs made by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-assets', 'chat-assets', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Daily AI message counter (private).
create table public.chat_usage (
  day  date primary key,
  hits integer not null default 0
);
alter table public.chat_usage enable row level security;
revoke all on table public.chat_usage from anon, authenticated;

-- Counts one AI message against today's shop-wide cap (Asia/Colombo day).
-- Returns false once the cap is reached; the caller treats any error as "over the cap".
create function public.chat_daily_hit(p_cap integer) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day  date := (now() at time zone 'Asia/Colombo')::date;
  v_hits integer;
begin
  if p_cap is null or p_cap < 1 then
    return false;
  end if;
  insert into public.chat_usage (day, hits) values (v_day, 1)
  on conflict (day) do update set hits = public.chat_usage.hits + 1
    where public.chat_usage.hits < p_cap
  returning hits into v_hits;
  return v_hits is not null;
end;
$$;

revoke all on function public.chat_daily_hit(integer) from public, anon, authenticated;
grant execute on function public.chat_daily_hit(integer) to service_role;
