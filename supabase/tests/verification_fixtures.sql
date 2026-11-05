-- Creates UNCONFIRMED test accounts (domain c1-english.test, no e-mail is sent) with known confirmation tokens,
-- exactly as Supabase Auth stores them after sign-up (auth.users.confirmation_token + auth.one_time_tokens).
-- Used by the "Verify e-mail flow" workflow. Parameters: :run (unique suffix), :pw (password).
do $$
declare r record; uid uuid; th text;
begin
  for r in select * from (values
      ('verify-desktop-' || current_setting('c1.run') || '@c1-english.test', now()),
      ('verify-mobile-'  || current_setting('c1.run') || '@c1-english.test', now()),
      ('verify-expired-' || current_setting('c1.run') || '@c1-english.test', now() - interval '3 days')) as t(email, sent) loop
    uid := gen_random_uuid();
    th := encode(extensions.digest(r.email || current_setting('c1.run'), 'sha224'), 'hex');
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, confirmation_token, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', r.email,
      extensions.crypt(current_setting('c1.pw'), extensions.gen_salt('bf')), th, r.sent,
      '{"provider":"email","providers":["email"]}', '{"display_name":"Test weryfikacji"}', r.sent, r.sent, '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', r.email, 'email_verified', false), 'email', r.sent, r.sent);
    insert into auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at)
    values (gen_random_uuid(), uid, 'confirmation_token', th, r.email, r.sent, r.sent);
  end loop;
end $$;
select u.email, u.confirmation_token as token_hash, u.email_confirmed_at from auth.users u
where u.email like 'verify-%-' || current_setting('c1.run') || '@c1-english.test' order by u.email;
