alter table public.users
  add column avatar_id text not null default 'anonymous-slate';

alter table public.users
  add constraint users_avatar_id_valid check (
    avatar_id in (
      'anonymous-slate',
      'basketball-blue',
      'whistle-green',
      'trophy-gold',
      'bolt-violet',
      'ticket-sky'
    )
  );
