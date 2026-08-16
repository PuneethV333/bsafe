-- Enforce the 5-contact cap at the DB level (app-level check in
-- contacts.service.ts is the primary gate; this trigger is the backstop so a
-- concurrent insert can't exceed the cap).
CREATE OR REPLACE FUNCTION enforce_contact_limit()
RETURNS trigger AS $$
DECLARE
  contact_count integer;
BEGIN
  SELECT COUNT(*) INTO contact_count
  FROM emergency_contacts
  WHERE user_id = NEW.user_id;

  IF contact_count >= 5 THEN
    RAISE EXCEPTION 'maximum of 5 contacts per user allowed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emergency_contacts_limit ON emergency_contacts;
CREATE TRIGGER trg_emergency_contacts_limit
BEFORE INSERT ON emergency_contacts
FOR EACH ROW EXECUTE FUNCTION enforce_contact_limit();
