import type { Actor, Business, Negotiation, Offer, PurchaseRequest, Role } from "./types";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that") { super(message); }
}
export class NotFoundError extends Error {
  constructor(what = "Record") { super(`${what} not found`); }
}
export class ValidationError extends Error {}

export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw new ForbiddenError();
}

export function canViewRequest(actor: Actor, req: PurchaseRequest, business?: Business): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "customer") return req.customerId === actor.userId;
  if (actor.role === "business" && business && business.id === actor.businessId) {
    return businessMatchesRequest(business, req);
  }
  return false;
}

export function businessMatchesRequest(b: Business, req: PurchaseRequest): boolean {
  return b.categories.includes(req.categoryId) && (b.regions.includes(req.region) || b.regions.includes("Australia-wide"));
}

export function canViewOffer(actor: Actor, offer: Offer, req: PurchaseRequest): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "business") return offer.businessId === actor.businessId;
  if (actor.role === "customer") return req.customerId === actor.userId && offer.status !== "draft";
  return false;
}

export function canViewNegotiation(actor: Actor, n: Negotiation): boolean {
  if (actor.role === "admin") return true;
  if (actor.role === "customer") return n.customerId === actor.userId;
  if (actor.role === "business") return !!n.businessId && n.businessId === actor.businessId;
  return false;
}
