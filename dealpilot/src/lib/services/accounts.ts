import { hashPassword, verifyPassword } from "../auth/password";
import { isCategory } from "../domain/categories";
import type { Cents } from "../domain/money";
import { ACTIVE_STATES } from "../domain/negotiation";
import { ForbiddenError, requireRole, ValidationError } from "../domain/permissions";
import { summariseSavings } from "../domain/savings";
import type { Actor, Business, PermissionMode, Role, User } from "../domain/types";
import { audit, newId, type Ctx } from "./context";
import { myBusiness } from "./marketplace";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Uniform failure message and constant-ish work so accounts can't be enumerated. */
export async function authenticate(ctx: Ctx, email: string, password: string): Promise<User> {
  const users = await ctx.store.list("users", { email: email.trim().toLowerCase() });
  const user = users[0];
  const ok = verifyPassword(password, user?.passwordHash ?? "scrypt$0000$00");
  if (!user || !ok) throw new ValidationError("Email or password is incorrect");
  await audit(ctx, { userId: user.id, role: user.role }, "auth.signed_in", "user", user.id);
  return user;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: Exclude<Role, "admin">;
  region: string;
  businessName?: string;
  categories?: string[];
}

export async function signUp(ctx: Ctx, input: SignUpInput): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ValidationError("Enter a valid email");
  if (input.password.length < 10) throw new ValidationError("Use at least 10 characters for your password");
  if (!input.name.trim()) throw new ValidationError("Enter your name");
  if (!["customer", "business"].includes(input.role)) throw new ValidationError("Choose an account type");
  if ((await ctx.store.list("users", { email })).length) throw new ValidationError("An account with that email already exists");
  const now = ctx.now().toISOString();
  const user: User = {
    id: newId(), email, name: input.name.trim().slice(0, 80), role: input.role, passwordHash: hashPassword(input.password),
    permissionMode: "approval", autopilotLimitCents: 0, region: input.region.trim().slice(0, 80) || "Australia-wide", isDemo: false, createdAt: now,
  };
  if (input.role === "business") {
    const cats = (input.categories ?? []).filter(isCategory);
    if (!input.businessName?.trim()) throw new ValidationError("Enter your business name");
    if (!cats.length) throw new ValidationError("Choose at least one service category");
    const b: Business = {
      id: newId(), ownerId: user.id, name: input.businessName.trim().slice(0, 120), description: "", categories: cats, regions: [user.region],
      qualifications: [], insured: false, reviewCount: 0, reviewsVerified: false, isSimulated: false, createdAt: now,
    };
    user.businessId = b.id;
    await ctx.store.insert("users", user);
    await ctx.store.insert("businesses", b);
  } else {
    await ctx.store.insert("users", user);
  }
  await audit(ctx, { userId: user.id, role: user.role }, "auth.signed_up", "user", user.id);
  return user;
}

export async function updateSettings(ctx: Ctx, actor: Actor, input: { permissionMode: PermissionMode; autopilotLimitCents: Cents; region: string }) {
  requireRole(actor, "customer");
  if (!["advisory", "approval", "autopilot"].includes(input.permissionMode)) throw new ValidationError("Invalid mode");
  if (!Number.isInteger(input.autopilotLimitCents) || input.autopilotLimitCents < 0 || input.autopilotLimitCents > 500_000) throw new ValidationError("Autopilot limit must be between $0 and $5,000");
  const before = (await ctx.store.get("users", actor.userId))!;
  await ctx.store.update("users", actor.userId, { permissionMode: input.permissionMode, autopilotLimitCents: input.autopilotLimitCents, region: input.region.trim().slice(0, 80) || before.region });
  await audit(ctx, actor, "settings.updated", "user", actor.userId, { from: { mode: before.permissionMode, limit: before.autopilotLimitCents }, to: { mode: input.permissionMode, limit: input.autopilotLimitCents } });
}

export async function updateBusinessProfile(ctx: Ctx, actor: Actor, input: Partial<Pick<Business, "name" | "abn" | "description" | "categories" | "regions" | "qualifications" | "licenceNumber" | "insured">>) {
  const b = await myBusiness(ctx, actor);
  const categories = input.categories?.filter(isCategory);
  if (categories && !categories.length) throw new ValidationError("Choose at least one category");
  if (input.abn && !/^\d{11}$/.test(input.abn.replace(/\s/g, ""))) throw new ValidationError("ABN must be 11 digits");
  const patch: Partial<Business> = {
    name: input.name?.trim().slice(0, 120) || b.name,
    abn: input.abn?.replace(/\s/g, "") || undefined,
    description: input.description?.slice(0, 1000) ?? b.description,
    categories: categories ?? b.categories,
    regions: input.regions?.map((r) => r.trim()).filter(Boolean).slice(0, 20) ?? b.regions,
    qualifications: input.qualifications?.map((q) => q.trim()).filter(Boolean).slice(0, 20) ?? b.qualifications,
    licenceNumber: input.licenceNumber?.trim() || undefined,
    insured: input.insured ?? b.insured,
  };
  await ctx.store.update("businesses", b.id, patch);
  await audit(ctx, actor, "business.profile_updated", "business", b.id);
}

export async function customerDashboard(ctx: Ctx, actor: Actor) {
  requireRole(actor, "customer");
  const [txs, negotiations, alerts, requests, watches, groups] = await Promise.all([
    ctx.store.list("transactions", { customerId: actor.userId }),
    ctx.store.list("negotiations", { customerId: actor.userId }),
    ctx.store.list("alerts", { userId: actor.userId }),
    ctx.store.list("requests", { customerId: actor.userId }),
    ctx.store.list("watches", { userId: actor.userId }),
    ctx.store.list("groups"),
  ]);
  return {
    summary: summariseSavings(txs),
    pendingTransactions: txs.filter((t) => t.status === "pending_verification"),
    activeNegotiations: negotiations.filter((n) => ACTIVE_STATES.includes(n.state)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    needsAction: negotiations.filter((n) => ["awaiting_approval", "counter_received", "escalated"].includes(n.state)),
    unreadAlerts: alerts.filter((a) => !a.read).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    openRequests: requests.filter((r) => ["open", "negotiating", "awarded"].includes(r.status)),
    watchCount: watches.filter((w) => w.active).length,
    groupCount: groups.filter((g) => g.memberIds.includes(actor.userId)).length,
  };
}

export async function businessDashboard(ctx: Ctx, actor: Actor) {
  const b = await myBusiness(ctx, actor);
  const [offers, negotiations, txs, requests] = await Promise.all([
    ctx.store.list("offers", { businessId: b.id }),
    ctx.store.list("negotiations", { businessId: b.id }),
    ctx.store.list("transactions", { businessId: b.id }),
    ctx.store.list("requests"),
  ]);
  const submitted = offers.filter((o) => o.status !== "draft");
  const won = offers.filter((o) => o.status === "accepted");
  const matching = requests.filter((r) => ["open", "negotiating"].includes(r.status) && r.categoryId && b.categories.includes(r.categoryId) && (b.regions.includes(r.region) || b.regions.includes("Australia-wide")));
  return {
    business: b,
    matchingRequests: matching.length,
    offersSubmitted: submitted.length,
    offersWon: won.length,
    winRate: submitted.length ? Math.round((won.length / submitted.length) * 100) : 0,
    wonValueCents: txs.filter((t) => t.status !== "cancelled").reduce((s, t) => s + t.finalCents, 0),
    awaitingReply: negotiations.filter((n) => n.state === "awaiting_counterparty").length,
    customersAcquired: new Set(txs.filter((t) => t.status === "verified").map((t) => t.customerId)).size,
  };
}

export async function listAudit(ctx: Ctx, actor: Actor, limit = 200) {
  if (actor.role !== "admin") throw new ForbiddenError();
  return (await ctx.store.list("audit")).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function listMyAudit(ctx: Ctx, actor: Actor, limit = 100) {
  return (await ctx.store.list("audit", { actorId: actor.userId })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
