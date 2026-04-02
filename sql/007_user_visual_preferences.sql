ALTER TABLE users
ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'light';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT 'blue';

UPDATE users
SET
  theme_preference = 'light'
WHERE theme_preference IS NULL
   OR theme_preference NOT IN ('light', 'dark');

UPDATE users
SET
  accent_color = 'blue'
WHERE accent_color IS NULL
   OR accent_color NOT IN ('blue', 'green', 'orange', 'red', 'teal');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_theme_preference_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_theme_preference_check
    CHECK (theme_preference IN ('light', 'dark'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_accent_color_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_accent_color_check
    CHECK (accent_color IN ('blue', 'green', 'orange', 'red', 'teal'));
  END IF;
END $$;
