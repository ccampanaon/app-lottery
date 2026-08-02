import { Info } from 'lucide-react';

/**
 * Permanent, not dismissible. The page generates plausible-looking predictions;
 * without this it would imply a forecasting power that does not exist.
 */
export function DisclaimerBanner() {
  return (
    <div className="border-warning/30 bg-warning/10 flex gap-3 rounded-lg border p-3.5">
      <Info className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-sm">
        <p className="font-medium">These are pattern analyses, not forecasts.</p>
        <p className="text-muted-foreground mt-1">
          Every Powerball draw is independent, with fixed odds of 1 in 292,201,338. No amount of
          history — and no model, neural or otherwise — changes the chance of any particular set
          winning. What follows describes what <em>has</em> happened, not what will.
        </p>
      </div>
    </div>
  );
}
