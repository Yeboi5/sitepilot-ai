import type { CredentialState } from "@/lib/domain/verification";
import type { AbnStatus, VerificationStatus } from "@/lib/domain/types";
import { Badge, type Tone } from "./ui";

const STATUS: Record<VerificationStatus, [Tone, string]> = {
  unverified: ["slate", "Not verified"], pending: ["amber", "Verification pending"], verified: ["green", "Verified by DealPilot"],
  suspended: ["red", "Suspended"], rejected: ["red", "Verification rejected"],
};
export const VerificationBadge = ({ status }: { status: VerificationStatus }) => <Badge tone={STATUS[status][0]}>{STATUS[status][1]}</Badge>;

const ABN: Record<AbnStatus, [Tone, string]> = {
  not_checked: ["slate", "Not checked"], checksum_valid: ["amber", "Valid format — registration not yet confirmed"], invalid: ["red", "Invalid ABN"],
  abr_active: ["green", "Active on ABN Lookup"], abr_cancelled: ["red", "Cancelled on ABN Lookup"], abr_not_found: ["red", "Not found on ABN Lookup"],
  admin_confirmed: ["green", "Confirmed by administrator"],
};
export const AbnBadge = ({ status }: { status?: AbnStatus }) => <Badge tone={ABN[status ?? "not_checked"][0]}>{ABN[status ?? "not_checked"][1]}</Badge>;

const CRED: Record<CredentialState, [Tone, string]> = {
  verified: ["green", "Verified"], expiring: ["amber", "Verified · expires within 30 days"], expired: ["red", "Expired"],
  submitted: ["amber", "Awaiting review"], rejected: ["red", "Rejected"], missing: ["slate", "Not provided"],
};
export const CredentialBadge = ({ state }: { state: CredentialState }) => <Badge tone={CRED[state][0]}>{CRED[state][1]}</Badge>;
