alter table public.scanner_sessions
  add column revoked_at timestamptz,
  add constraint scanner_sessions_token_hash_sha256 check (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint scanner_sessions_expiration_after_creation check (
    expires_at > created_at
  ),
  add constraint scanner_sessions_revocation_after_creation check (
    revoked_at is null or revoked_at >= created_at
  ),
  add constraint scanner_sessions_gate_name_length check (
    char_length(trim(gate_name)) <= 80
  ),
  add constraint scanner_sessions_staff_label_length check (
    char_length(trim(staff_label)) <= 100
  );

alter table public.scanner_sessions
  drop constraint scanner_sessions_permissions_valid,
  add constraint scanner_sessions_permissions_valid check (
    permissions <@ array['scan', 'lookup', 'recent', 'manual_sale']::text[]
    and cardinality(permissions) > 0
    and 'scan' = any(permissions)
  );

create index scanner_sessions_active_tournament_expires_at_idx
  on public.scanner_sessions (tournament_id, expires_at)
  where revoked_at is null;
