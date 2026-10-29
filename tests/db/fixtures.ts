// Fixed ids from supabase/seed.sql (synthetic data).
export const AUTH = {
  ivy: "a0000000-0000-4000-8000-000000000001", // investor admin, Harbourview
  connie: "a0000000-0000-4000-8000-000000000002", // firm admin, Demo Conveyancing; edit grant on MATTER.active
  sam: "a0000000-0000-4000-8000-000000000003", // firm member, no matter grants
  oscar: "a0000000-0000-4000-8000-000000000004", // investor admin of a different organisation
  pat: "a0000000-0000-4000-8000-000000000005", // platform admin, no memberships
} as const;

export const USER = {
  ivy: "b0000000-0000-4000-8000-000000000001",
  connie: "b0000000-0000-4000-8000-000000000002",
  sam: "b0000000-0000-4000-8000-000000000003",
  oscar: "b0000000-0000-4000-8000-000000000004",
} as const;

export const ORG = {
  harbourview: "c0000000-0000-4000-8000-000000000001",
  firm: "c0000000-0000-4000-8000-000000000002",
  westside: "c0000000-0000-4000-8000-000000000003",
} as const;

export const PROPERTY = {
  invitedOnly: "d0000000-0000-4000-8000-000000000001", // matter is only 'invited'
  sharedActive: "d0000000-0000-4000-8000-000000000002", // active matter, Connie has edit
  westside: "d0000000-0000-4000-8000-000000000003",
} as const;

export const MATTER = {
  invited: "f0000000-0000-4000-8000-000000000001",
  active: "f0000000-0000-4000-8000-000000000002",
} as const;

export const DOCUMENT = {
  matterContract: "10000000-0000-4000-8000-000000000001",
  privateNotes: "10000000-0000-4000-8000-000000000002",
} as const;

export const FINDING = {
  settlement: "20000000-0000-4000-8000-000000000001",
} as const;
