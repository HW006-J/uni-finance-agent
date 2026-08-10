/**
 * This MVP has no authentication system. Every request operates against a
 * single, fixed demo profile so the hackathon judge/demoer always lands on
 * the same financial state. This id must match the row seeded by
 * supabase/migrations/0002_seed_demo_profile.sql.
 */
export const DEMO_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
