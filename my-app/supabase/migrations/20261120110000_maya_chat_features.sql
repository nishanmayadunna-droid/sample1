-- Maya chat: a topic can now depend on two more switches. `smsLogin` is phone sign-in and
-- `notify` is "the shop sends customers any notification" (order SMS, email or push).
-- `sms` now means the order-SMS switch. Additive: only widens an allowed list.

alter table public.chat_topics drop constraint if exists chat_topics_requires_check;
alter table public.chat_topics
  add constraint chat_topics_requires_check
  check (requires is null or requires in ('card', 'advance', 'sms', 'smsLogin', 'email', 'push', 'points', 'notify'));
