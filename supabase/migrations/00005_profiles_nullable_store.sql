-- ============================================================
-- Migration: Make profiles.store_id nullable
-- This allows user registration to succeed even when no store
-- exists yet. The auth trigger will insert a profile with
-- NULL store_id if no active store is found.
-- ============================================================

ALTER TABLE profiles ALTER COLUMN store_id DROP NOT NULL;
