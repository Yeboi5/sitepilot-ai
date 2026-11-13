import { formatMoney, parseMoney, type Cents } from "../domain/money";
import type { DocumentAnalysis, LineItem, Recurrence } from "../domain/types";
import type { AIProvider, AnalyseDocumentInput, DraftBid, DraftBidInput, DraftCounterInput, DraftMessageInput } from "./types";

const round100 = (c: number) => Math.round(c / 100) * 100;

/** Pulls "$1,234.56" style amounts and line items from plain text. */
export function extractAmounts(text: string): { total?: Cents; lines: LineItem[]; vendor?: string; recurrence?: Recurrence } {
  const lines: LineItem[] = [];
  let total: Cents | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^(.*?)[\s:.-]*\$\s?([\d,]+(?:\.\d{1,2})?)/);
    if (!m) continue;
    const cents = parseMoney(m[2]);
    if (cents === null) continue;
    const label = m[1].trim() || "Item";
    if (/total|amount due|balance/i.test(label)) total = cents;
    else lines.push({ description: label.slice(0, 120), amountCents: cents });
  }
  if (total === undefined && lines.length) total = lines.reduce((s, l) => s + l.amountCents, 0);
  const vendorMatch = text.match(/^(?:from|vendor|provider|supplier|company)\s*[:\-]\s*(.+)$/im);
  const recurrence: Recurrence | undefined = /per month|monthly|\/mo\b/i.test(text) ? "monthly" : /per year|annual|yearly/i.test(text) ? "annual" : undefined;
  return { total, lines, vendor: vendorMatch?.[1].trim().slice(0, 120), recurrence };
}

/**
 * Deterministic, offline provider. Clearly marked simulated. Uses category
 * benchmark ranges that are themselves simulated demo figures.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly simulated = true;

  async analyseDocument(input: AnalyseDocumentInput): Promise<DocumentAnalysis> {
    const isText = input.mimeType.startsWith("text/") || /\.(txt|csv|md)$/i.test(input.filename);
    const text = isText ? new TextDecoder().decode(input.data).slice(0, 50_000) : "";
    const ex = extractAmounts(text);
    const total = ex.total ?? input.statedAmountCents;
    const b = input.category.simulatedBenchmark;
    const keyTerms: string[] = [];
    const risks: string[] = [];
    if (/deposit/i.test(text)) keyTerms.push("Deposit required");
    if (/warranty/i.test(text)) keyTerms.push("Warranty mentioned");
    else if (input.category.id === "trades") risks.push("No warranty stated — ask for workmanship warranty in writing");
    if (/valid (for|until)/i.test(text)) keyTerms.push("Quote has an expiry date");
    if (/cancel|termination|break fee/i.test(text)) keyTerms.push("Cancellation / break fee terms");
    if (/price (may|can) (change|increase)|subject to change/i.test(text)) risks.push("Price can change — ask for a fixed price");
    if (input.category.requiresLicence && !/licen[cs]e/i.test(text)) risks.push("No licence number on the document");
    if (input.category.requiresInsurance && !/insur/i.test(text)) risks.push("Insurance not mentioned");
    if (!isText) risks.push("This file type can't be read by the offline demo analyser — figures come from what you entered");

    const analysis: DocumentAnalysis = {
      provider: this.name,
      simulated: true,
      vendor: ex.vendor,
      totalCents: total,
      recurrence: ex.recurrence ?? input.category.defaultRecurrence,
      lineItems: ex.lines.slice(0, 20),
      keyTerms,
      risks,
      summary: total
        ? `Detected a total of ${formatMoney(total)}${ex.vendor ? ` from ${ex.vendor}` : ""}. Simulated market range for similar ${input.category.name.toLowerCase()} is ${formatMoney(round100(total * b.low))}–${formatMoney(round100(total * b.high))}.`
        : "No total could be detected. Enter the amount manually to get a benchmark.",
      createdAt: new Date().toISOString(),
    };
    if (total) {
      analysis.benchmarkLowCents = round100(total * b.low);
      analysis.benchmarkHighCents = round100(total * b.high);
      analysis.suggestedTargetCents = analysis.benchmarkLowCents;
    }
    return analysis;
  }

  async draftNegotiationMessage({ negotiation: n, category, intent, priceCents, customerName }: DraftMessageInput): Promise<string> {
    const lever = category.negotiationLevers[0]?.toLowerCase() ?? "competing offers";
    const per = n.recurrence === "monthly" ? " per month" : n.recurrence === "annual" ? " per year" : "";
    switch (intent) {
      case "opening":
        return `Hi ${n.counterpartyName}, I'm reviewing my ${category.name.toLowerCase()} costs. I'm currently paying ${formatMoney(n.baselineCents)}${per}. Based on ${lever}, I'd like to stay with you at ${formatMoney(priceCents)}${per}. Can you offer that? — ${customerName}`;
      case "counter":
        return `Thanks for coming back with ${formatMoney(n.currentOfferCents)}${per}. I can commit today at ${formatMoney(priceCents)}${per}. If that works, please confirm in writing. — ${customerName}`;
      case "accept":
        return `Thank you — I accept ${formatMoney(priceCents)}${per}. Please send written confirmation with the full terms. — ${customerName}`;
      case "decline":
        return `Thanks for your time. I won't be proceeding at ${formatMoney(n.currentOfferCents)}${per}. — ${customerName}`;
    }
  }

  async draftBid({ request, business, category, floorHintCents }: DraftBidInput): Promise<DraftBid> {
    const target = round100(request.baselineCents * ((category.simulatedBenchmark.low + category.simulatedBenchmark.high) / 2));
    const price = floorHintCents ? Math.min(target, floorHintCents) : target;
    const trades = category.id === "trades";
    return {
      priceCents: Math.max(price, 100),
      scope: `${request.title}. ${request.description}`.slice(0, 400),
      materials: String(request.fields.material ?? (trades ? "Standard materials to Australian Standards" : "As specified")),
      warrantyMonths: trades ? 24 : category.id === "retail" ? 12 : 0,
      completionDays: trades ? 10 : 3,
      rationale: `Priced near the middle of the simulated market range for ${category.name.toLowerCase()}, about ${Math.round((1 - price / request.baselineCents) * 100)}% under the customer's existing quote. ${business.name} should check costs before approving.`,
    };
  }

  async draftBusinessCounter({ negotiation: n, business, requestedCents, minimumCents }: DraftCounterInput) {
    const price = Math.max(minimumCents, round100((requestedCents + n.currentOfferCents) / 2));
    return {
      priceCents: price,
      message: `Thanks for the request. We can't go to ${formatMoney(requestedCents)}, but ${business.name} can do ${formatMoney(price)} with the same scope and warranty if you confirm this week.`,
    };
  }
}
