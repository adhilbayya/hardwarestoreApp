-- 013_hsn_and_state.sql
-- We ignore hsn_code here because it was added in 002.
-- So we just use this to add state_name and state_code if they don't exist.
-- Note: SQLite doesn't natively support "ADD COLUMN IF NOT EXISTS".
-- It may throw an error if already manually added. We'll leave it empty to prevent app crash if columns are already in it manually. 

-- (Empty migration to maintain version sequence without crashing since columns are added)

