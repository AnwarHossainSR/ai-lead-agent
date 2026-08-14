import { Evidence } from "@/components/evidence";
import { Fact } from "@/components/fact";
import type { LatestAnalysis, TechnologyDetection } from "@/lib/lead-detail";

/**
 * Renders detected technologies. An observed detection with matched text
 * links to the page it was found on through `<Evidence>`; an inferred
 * detection carries `<Fact>`'s inferred marker instead of being presented
 * as equally certain.
 */
export function TechnologyList({
  detections,
  analysis,
}: {
  detections: readonly TechnologyDetection[];
  analysis: LatestAnalysis | null;
}) {
  if (detections.length === 0) {
    return <p className="text-sm text-muted-foreground">No technologies detected.</p>;
  }

  const detectionById = new Map(detections.map((detection) => [detection.id, detection]));

  return (
    <ul className="space-y-2">
      {detections.map((detection) => {
        const label = `${detection.technologyId} (${detection.category})`;

        if (detection.certainty === "observed" && detection.matchedText) {
          return (
            <li key={detection.id} className="text-sm">
              {analysis?.analysedUrl && analysis.createdAt ? (
                <Evidence
                  sourceUrl={analysis.analysedUrl}
                  recordedAt={analysis.createdAt}
                  detail={`Matched "${detection.matchedText}"${detection.matchedIn ? ` in ${detection.matchedIn}` : ""}`}
                >
                  {label}
                </Evidence>
              ) : (
                label
              )}
            </li>
          );
        }

        const impliedByLabel = detection.impliedBy
          ? detectionById.get(detection.impliedBy)?.technologyId
          : undefined;

        return (
          <li key={detection.id} className="text-sm">
            <Fact
              fact={{
                certainty: "inferred",
                value: label,
                inferredFrom: impliedByLabel ? `detecting ${impliedByLabel}` : undefined,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
