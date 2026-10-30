/**
 * General maintenance and renovation ideas for My Property. Curated, generic guidance: no AI,
 * no cost figures, no planning claims. Anything structural or regulated needs licensed trades and
 * council or state approval.
 */
export type Idea = { title: string; detail: string };

export const MAINTENANCE_IDEAS: Idea[] = [
  { title: "Test smoke alarms", detail: "Press the test button monthly; replace batteries as the manufacturer recommends." },
  { title: "Clean gutters and downpipes", detail: "Especially before storm or bushfire season." },
  { title: "Check for water leaks", detail: "Look under sinks and around the hot water system; watch your water bill." },
  { title: "Service heating and cooling", detail: "Clean filters and book a service with a licensed technician." },
  { title: "Inspect the roof and eaves", detail: "From the ground or with a professional; never climb on a roof alone." },
  { title: "Termite inspection", detail: "Book a licensed pest inspector, typically once a year in many areas." },
];

export const RENOVATION_IDEAS: Idea[] = [
  { title: "Refresh the kitchen", detail: "Benchtops, splashback, lighting. Try a concept in SitePilot Vision." },
  { title: "Update the bathroom", detail: "Waterproofing and plumbing need licensed trades." },
  { title: "Add outdoor living", detail: "A deck or pergola may need council approval depending on size and location." },
  { title: "Improve energy efficiency", detail: "Insulation, draught sealing, solar. Check state rebates." },
  { title: "Garden and landscaping", detail: "Low-maintenance planting, shade trees, a veggie patch." },
];

export const IDEAS_DISCLAIMER = "General ideas only, not advice. Check council rules and use licensed trades for regulated work.";
