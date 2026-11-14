"use server";

import { requireUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/domain/permissions";
import { appCtx } from "@/lib/services/app-context";
import { confirmAbnManually, reviewCredential, setBusinessStatus } from "@/lib/services/verification";
import { act, str } from "./helpers";

async function admin() {
  const { actor } = await requireUser("admin");
  return { actor, ctx: await appCtx() };
}

const back = (fd: FormData) => `/admin/businesses/${str(fd, "businessId")}`;

export async function reviewCredentialAction(fd: FormData) {
  const { actor, ctx } = await admin();
  const decision = str(fd, "decision");
  await act(async () => {
    if (decision !== "verified" && decision !== "rejected") throw new ValidationError("Choose a decision");
    return reviewCredential(ctx, actor, str(fd, "credentialId"), decision, str(fd, "notes"), str(fd, "method") === "register_lookup" ? "register_lookup" : "admin_document_review");
  }, () => back(fd), back(fd), `Credential ${decision}`);
}

export async function confirmAbnAction(fd: FormData) {
  const { actor, ctx } = await admin();
  await act(async () => {
    if (fd.get("checked") !== "on") throw new ValidationError("Confirm you checked the ABN on ABN Lookup");
    return confirmAbnManually(ctx, actor, str(fd, "businessId"), str(fd, "entityName"));
  }, () => back(fd), back(fd), "ABN confirmed");
}

export async function setBusinessStatusAction(fd: FormData) {
  const { actor, ctx } = await admin();
  const status = str(fd, "status") as "verified" | "rejected" | "suspended" | "unverified";
  await act(async () => {
    if (!["verified", "rejected", "suspended", "unverified"].includes(status)) throw new ValidationError("Choose a status");
    return setBusinessStatus(ctx, actor, str(fd, "businessId"), status, str(fd, "reason"));
  }, () => back(fd), back(fd), `Business ${status}`);
}
