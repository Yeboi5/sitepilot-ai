import { Alert, Badge } from "./ui";

export function DemoBadge() {
  return <Badge tone="warning">Demo · unverified</Badge>;
}

export function DemoDataBanner() {
  return (
    <Alert tone="warning">
      <strong>Demo data. Unverified.</strong> This property and its evidence are synthetic fixtures for testing. No
      planning, zoning or valuation information here has been obtained from an official source, and none of it can be
      marked verified. Do not rely on it.
    </Alert>
  );
}
