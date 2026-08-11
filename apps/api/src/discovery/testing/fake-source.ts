import type {
  DiscoveryRequest,
  DiscoverySource,
  DiscoverySourceResult,
  DiscoverySourceSuccess,
} from "../sources/source";

/**
 * A scriptable discovery source for tests (design D8). It returns whatever
 * results it was constructed with, one per call, and records the requests it
 * received so a test can assert what was asked. No network, no state beyond
 * what the test set up — a source that can return candidates, an empty
 * result, a block and a failure.
 */
export class FakeDiscoverySource implements DiscoverySource {
  readonly sourceId: string;
  readonly requests: DiscoveryRequest[] = [];

  private readonly results: readonly DiscoverySourceResult[];
  private calls = 0;

  constructor(sourceId: string, results: readonly DiscoverySourceResult[]) {
    this.sourceId = sourceId;
    this.results = results;
  }

  async fetch(request: DiscoveryRequest): Promise<DiscoverySourceResult> {
    this.requests.push(request);

    const result = this.results[this.calls];

    // A source is consulted once per run. Running out of results means the
    // test asked for more behaviour than it set up, which is a bug in the
    // test, not a runtime condition.
    if (result === undefined) {
      throw new Error(
        `FakeDiscoverySource "${this.sourceId}" has no result left for call ${this.calls + 1}.`,
      );
    }

    this.calls += 1;
    return result;
  }
}

/** A source that always returns the given candidates (or none, for empty). */
export function fakeSucceededSource(
  sourceId: string,
  candidates: DiscoverySourceResult["candidates"] = [],
  rejections: DiscoverySourceResult["rejections"] = [],
): FakeDiscoverySource {
  return new FakeDiscoverySource(sourceId, [{ outcome: "succeeded", candidates, rejections }]);
}

/** A source that answers with a block, ending the source for the run. */
export function fakeBlockedSource(sourceId: string, note = "blocked by host"): FakeDiscoverySource {
  return new FakeDiscoverySource(sourceId, [{ outcome: "blocked", note }]);
}

/** A source that fails, so a run can record a partial outcome. */
export function fakeFailedSource(sourceId: string, reason = "provider error"): FakeDiscoverySource {
  return new FakeDiscoverySource(sourceId, [{ outcome: "failed", reason }]);
}
