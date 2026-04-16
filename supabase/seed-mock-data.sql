-- Mock data for testing the Morning invoice flow.
-- Run this in Supabase SQL Editor after logging in with the dev user.
-- Replace USER_ID below with the actual auth.users.id of your dev user.

-- Step 1: Find your dev user ID by running:
--   SELECT id, email FROM auth.users;
-- Then replace 'YOUR_USER_ID' below.

DO $$
DECLARE
  uid uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  s1 uuid; s2 uuid; s3 uuid; s4 uuid;
  today text := to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD');
BEGIN
  -- Get the first user (dev user)
  SELECT id INTO uid FROM auth.users LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No user found in auth.users. Log in first.';
  END IF;

  -- Generate UUIDs
  p1 := gen_random_uuid(); p2 := gen_random_uuid();
  p3 := gen_random_uuid(); p4 := gen_random_uuid();
  s1 := gen_random_uuid(); s2 := gen_random_uuid();
  s3 := gen_random_uuid(); s4 := gen_random_uuid();

  -- Insert mock patients (matching mock calendar event attendee emails)
  INSERT INTO patients (id, user_id, full_name, phone, email, chief_complaint, created_at)
  VALUES
    (p1, uid, 'רונית כהן',   '050-1111111', 'ronit@example.com',  'כאבי גב תחתון',    now()),
    (p2, uid, 'דני לוי',     '050-2222222', 'dani@example.com',   'מיגרנות',          now()),
    (p3, uid, 'מיכל אברהם',  '050-3333333', 'michal@example.com', 'חרדה ונדודי שינה', now()),
    (p4, uid, 'יוסי חדד',    '050-4444444', 'yossi@example.com',  'כאבי ברכיים',      now())
  ON CONFLICT (id) DO NOTHING;

  -- Insert mock sessions linked to mock calendar events
  -- s1: paid + has price → needs-invoice (ready to send)
  -- s2: paid + no price  → needs-invoice (will prompt for price)
  -- s3: not paid         → needs-payment
  -- s4: no note (note insert skipped below) → needs-note
  INSERT INTO sessions (id, user_id, patient_id, google_event_id, date, session_number, duration, paid, invoice_sent, price)
  VALUES
    (s1, uid, p1, 'mock-event-1', (today || ' 09:00:00+03')::timestamptz, 3, 45, true,  false, 350),
    (s2, uid, p2, 'mock-event-2', (today || ' 10:00:00+03')::timestamptz, 5, 45, true,  false, NULL),
    (s3, uid, p3, 'mock-event-4', (today || ' 12:00:00+03')::timestamptz, 2, 60, false, false, NULL),
    (s4, uid, p4, 'mock-event-5', (today || ' 14:00:00+03')::timestamptz, 1, 45, false, false, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Insert notes for s1-s3 only (s4 has no note → needs-note status)
  INSERT INTO notes (id, user_id, session_id, content, note_type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), uid, s1, 'טיפול בנקודות GB34, BL40, DU20. שיפור בטווח תנועה.', 'session', now(), now()),
    (gen_random_uuid(), uid, s2, 'דיקור LI4, LV3, GB20. דיווח על הפחתה בתדירות המיגרנות.', 'session', now(), now()),
    (gen_random_uuid(), uid, s3, 'HT7, SP6, PC6. מטופלת מדווחת על שיפור בשינה.', 'session', now(), now())
  ON CONFLICT DO NOTHING;

  -- Summary:
  -- רונית כהן (09:00)  → needs-invoice (paid, has price 350, has note)
  -- דני לוי  (10:00)  → needs-invoice (paid, no price, has note)
  -- מיכל אברהם (12:00) → needs-payment (not paid, has note)
  -- יוסי חדד (14:00)  → needs-note (no note)
  RAISE NOTICE 'Mock data seeded for user % — 4 patients, 4 sessions (mixed statuses)', uid;
END $$;
