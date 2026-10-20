-- Disposable database only; fixtures roll back, with no Stripe requests.
begin;
do $$
declare
  u uuid := gen_random_uuid(); live_user uuid := gen_random_uuid(); org bigint; live_org bigint; event bigint; ticket bigint;
  old_account text := 'acct_transitionold'; new_account text := 'acct_transitionnew';
  reservation jsonb; old_order bigint; new_order bigint; denied boolean; next_id bigint;
begin
  assert not has_function_privilege('anon','private.transition_sandbox_stripe_account(bigint,uuid,text,text,text)','EXECUTE');
  assert not has_function_privilege('authenticated','private.transition_sandbox_stripe_account(bigint,uuid,text,text,text)','EXECUTE');
  assert not has_function_privilege('service_role','private.transition_sandbox_stripe_account(bigint,uuid,text,text,text)','EXECUTE');
  assert not has_table_privilege('authenticated','private.sandbox_stripe_account_transitions','SELECT');
  insert into auth.users(id,email,raw_user_meta_data) values(u,u||'@example.invalid','{"name":"Transition"}');
  insert into auth.users(id,email,raw_user_meta_data) values(live_user,live_user||'@example.invalid','{"name":"Live"}');
  insert into public.organizations(name,owner_user_id,operating_environment)
    values('Transition',u,'test') returning id into org;
  insert into public.organizations(name,owner_user_id,operating_environment)
    values('Live unchanged',live_user,'live') returning id into live_org;
  insert into public.organization_stripe_accounts(organization_id,stripe_account_id,stripe_environment,
    onboarding_complete,charges_enabled,payouts_enabled,card_payments_status,payouts_status)
    values(org,old_account,'test',true,true,true,'active','active');
  insert into public.tournaments(organization_id,name,start_date,end_date,venue_name,organizer_name,contact_email,public_slug,status,time_zone)
    values(org,'Transition',current_date,current_date+2,'Venue','Director','buyer@example.invalid','transition-fixture','published','UTC') returning id into event;
  insert into public.ticket_types(tournament_id,name,price,valid_from,valid_until)
    values(event,'Admission',10,current_date,current_date+2) returning id into ticket;
  reservation := public.reserve_checkout_order_with_buyer_fee('transition-fixture','Buyer','buyer@example.invalid',null,null,
    jsonb_build_array(jsonb_build_object('ticket_type_id',ticket,'quantity',1)),'test',0,0,'test');
  assert reservation->>'status'='reserved'; old_order := (reservation->>'order_id')::bigint;

  denied:=false;
  begin perform private.transition_sandbox_stripe_account(org,gen_random_uuid(),old_account,new_account,'Wrong owner');
  exception when others then denied:=true; end;
  assert denied,'Wrong owner must be rejected';
  denied:=false;
  begin perform private.transition_sandbox_stripe_account(live_org,live_user,old_account,new_account,'No live writes');
  exception when others then denied:=true; end;
  assert denied,'Live organization must be rejected';
  denied:=false;
  begin perform private.transition_sandbox_stripe_account(org,u,'acct_wrong',new_account,'Stale old account');
  exception when others then denied:=true; end;
  assert denied,'Stale connection must be rejected';

  next_id:=private.transition_sandbox_stripe_account(org,u,old_account,new_account,'Explicit Sandbox QA approval');
  assert (select count(*)=2 from public.organization_stripe_accounts where organization_id=org),'Both account records must survive';
  assert (select not is_current and charges_enabled from public.organization_stripe_accounts where stripe_account_id=old_account),'Retired record and capabilities must survive';
  assert not public.organization_stripe_account_is_ready(org,'test'),'Old ready account must not mask unverified replacement';
  assert (select stripe_connected_account_id=old_account from public.orders where id=old_order);
  assert (select not charges_enabled and not payouts_enabled and last_synced_at is null
    from public.organization_stripe_accounts where id=next_id),'Replacement must require fresh Stripe verification';
  assert (select old_connection->>'stripe_account_id'=old_account from private.sandbox_stripe_account_transitions where organization_id=org);

  -- Ordinary synchronization remains permitted; direct account reassignment does not.
  update public.organization_stripe_accounts set charges_enabled=true,payouts_enabled=true,onboarding_complete=true,
    card_payments_status='active',payouts_status='active' where id=next_id;
  insert into public.organization_stripe_accounts(organization_id,stripe_account_id,stripe_environment,charges_enabled)
    values(org,old_account,'test',true) on conflict(stripe_account_id) do update set charges_enabled=excluded.charges_enabled;
  assert (select not is_current from public.organization_stripe_accounts where stripe_account_id=old_account),'Old webhook sync must not promote retired account';
  denied:=false;
  begin update public.organization_stripe_accounts set stripe_account_id='acct_other' where id=next_id;
  exception when others then denied:=true; end;
  assert denied,'Current-account routing must remain immutable';

  set local role service_role;
  update public.orders set payment_status='paid',stripe_payment_intent_id='pi_historical' where id=old_order;
  update public.orders set amount_refunded=1 where id=old_order;
  reset role;
  assert (select stripe_connected_account_id=old_account and amount_refunded=1 from public.orders where id=old_order),
    'Historical webhook/refund updates must retain the original account';
  denied:=false;
  begin update public.orders set stripe_connected_account_id=new_account where id=old_order;
  exception when others then denied:=true; end;
  assert denied,'Historical orders cannot be reassigned';

  reservation:=public.reserve_checkout_order_with_buyer_fee('transition-fixture','Buyer','buyer@example.invalid',null,null,
    jsonb_build_array(jsonb_build_object('ticket_type_id',ticket,'quantity',1)),'test',0,0,'test');
  assert reservation->>'status'='reserved' and reservation->>'stripe_connected_account_id'=new_account;
  new_order:=(reservation->>'order_id')::bigint;
  denied:=false;
  begin
    insert into public.orders(tournament_id,buyer_name,buyer_email,amount_total,stripe_environment,stripe_connected_account_id)
      values(event,'Buyer','buyer@example.invalid',10,'test',old_account);
  exception when raise_exception then denied:=true; end;
  assert denied,'New orders cannot use the retired account';
  assert (select stripe_connected_account_id=new_account from public.orders where id=new_order);
end;
$$;
rollback;
