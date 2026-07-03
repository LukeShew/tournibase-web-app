create index check_ins_undone_by_scanner_session_id_idx
  on public.check_ins (undone_by_scanner_session_id)
  where undone_by_scanner_session_id is not null;
