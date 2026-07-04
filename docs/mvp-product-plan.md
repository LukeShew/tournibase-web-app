# TourniBase Web MVP Product Plan

Last updated: July 4, 2026

## Current product

TourniBase is a digital gate system for youth basketball tournaments.

The current product is the web app in this repository. It gives tournament
directors one place to sell spectator passes, issue mobile tickets, operate
secure gate scanners, stop duplicate admissions, and review sales and gate
activity.

This web MVP is the main TourniBase product while the business validates demand
with real tournament directors.

## Product promises

- Directors: “Sell tournament passes online, scan people in faster, and stop
  duplicate tickets at the gate.”
- Parents: “Buy before arrival. Show your pass. Skip the line.”
- Gate staff: “Scan the QR. Green means go. Red means stop.”

## Primary users

### Tournament directors

Directors create and publish admission events, create ticket types, share the
buyer link, create temporary scanner links, and monitor sales and gate activity.

### Parents and spectators

Buyers open a public event page, select passes, pay through Stripe Checkout, and
present an individual mobile pass at the gate.

### Gate staff

Staff open a temporary scanner link on a phone, scan or manually enter passes,
handle duplicate warnings, look up orders when permitted, and record in-person
sales when permitted.

## Included in the web MVP

- Invite-only director login
- Tournament creation and publishing
- Ticket type creation, editing, activation, and deactivation
- Public event and coach-sharing pages
- Stripe-hosted online checkout in test mode
- Paid-order fulfillment with one mobile pass per admission
- Mobile pass pages with QR codes
- Temporary, revocable scanner links with permission levels
- Camera scanning and manual pass entry
- Server-authoritative pass validation
- Duplicate blocking, reasoned overrides, and check-in undo
- Buyer and order lookup with manual check-in
- Persisted recent scanner activity
- Optional recording of cash, Venmo, external-card, and comp gate sales
- Director sales, revenue, admission, and gate-activity dashboards
- Tournament-local time-zone handling

## Core user journeys

### Create and publish a tournament

1. A director signs in at `/login`.
2. The director opens `/dashboard/tournaments/new`.
3. They enter the event, venue, organizer, contact, date, and public-link
   details.
4. TourniBase creates the tournament as a draft.
5. The director adds at least one active ticket type.
6. The director publishes the event from its overview.

### Create ticket types

1. The director opens the tournament’s **Ticket types** page.
2. They add the ticket name, price, valid dates, description, and optional
   quantity limit.
3. TourniBase verifies that the ticket dates fall within the tournament dates.
4. Active ticket types appear on the published public event page.

### Buy and receive a pass

1. A buyer opens `/e/[event-slug]`.
2. They choose ticket quantities and provide contact information.
3. TourniBase creates a pending order and immutable order-item snapshots.
4. Stripe Checkout collects payment.
5. A signed Stripe success event marks the order paid and creates one pass per
   purchased admission.
6. The success page shows the buyer’s individual mobile pass links.

Production pass-link email delivery is not implemented yet. Until it is added,
the buyer must keep or bookmark the success-page links.

### Admit a buyer

1. A director creates a temporary scanner link for a specific tournament and
   gate.
2. Gate staff open `/scan/[scanner-token]` on a phone.
3. The scanner reads the QR code or accepts the pass link/token manually.
4. The server verifies the scanner session, tournament, paid order, pass
   status, valid date, and prior admissions.
5. A valid pass is checked in atomically and returns a green result.
6. A second use is blocked and returns **ALREADY SCANNED**.
7. Staff with the required permission may override a duplicate with a recorded
   reason.

### Record an in-person sale

1. Full-gate staff open **Gate sale** from the scanner.
2. They choose a ticket, quantity, and payment method.
3. They may add a buyer name and notes.
4. TourniBase records the admission and revenue for reporting.

This feature records payment collected outside TourniBase. It does not charge a
card or issue a digital pass.

## Not included right now

- Tournament scheduling, brackets, teams, scores, standings, or referee tools
- A full point-of-sale card terminal
- Automated refunds or dispute handling
- Production transactional pass emails
- Native iOS or Android apps
- New waitlist-site work

## Postponed products

### Waitlist website

The waitlist website is a separate repository and deployment. It is postponed
and is not part of the current MVP roadmap.

### Native app

A native mobile app is a future pivot, not the current product. TourniBase
should consider it only after the web MVP proves that directors and gate staff
use the core admission flow at real tournaments.

## MVP validation goals

The web MVP is successful when it can reliably:

- Let a director configure an event without developer help
- Complete a real online purchase and deliver usable passes
- Admit guests quickly on ordinary phones
- Block duplicate and invalid passes under gate pressure
- Give directors understandable sales and attendance totals
- Recover from camera problems through lookup and manual entry

## Remaining roadmap

Phases 16–18 are complete. The local demo seed is guarded against hosted
Supabase URLs, and the install, lint, typecheck, and production build checks
pass. The remaining planned work is:

1. Phase 19: complete the final Git review and MVP handoff.

Before charging real customers, TourniBase also needs production pass-link email
delivery, Stripe live-mode configuration, and one complete live-mode purchase,
webhook, pass, and scan verification.

See [Implementation Roadmap](./implementation-roadmap.md) for the current
phase-by-phase status.
