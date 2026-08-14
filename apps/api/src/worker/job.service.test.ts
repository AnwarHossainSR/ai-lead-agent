import { describe, expect, it } from "vitest";

import { JobService, Skipped, ValidationError } from "./job.service";
import { QueueService } from "./queue.service";

class FakeQStashClient {
  async publish(_options: any): Promise<{ messageId: string }> {
    return { messageId: "msg-123" };
  }
}

describe("JobService", () => {
  const createService = () => {
    const qstash = new FakeQStashClient() as any;
    const queueService = new QueueService(qstash, "https://qstash-eu-central-1.upstash.io");
    queueService.setup();
    return new JobService(queueService);
  };

  describe("validatePayload", () => {
    it("accepts a valid payload", () => {
      const service = createService();
      const payload = service.validatePayload("scoring", {
        companyId: "company-1",
        weightVersion: 1,
      });
      expect((payload as any).companyId).toBe("company-1");
    });

    it("rejects an invalid payload naming the invalid fields", () => {
      const service = createService();
      expect(() => service.validatePayload("scoring", { companyId: "company-1" })).toThrow(
        /weightVersion/,
      );
    });

    it("throws ValidationError for an unknown job type", () => {
      const service = createService();
      expect(() => service.validatePayload("unknown" as any, {})).toThrow(/Unknown job type/);
    });
  });

  describe("enqueue", () => {
    it("refuses an invalid payload and writes nothing", async () => {
      const service = createService();
      await expect(service.enqueue("scoring", { companyId: "company-1" })).rejects.toThrow(
        ValidationError,
      );
    });

    it("publishes a valid payload to QStash", async () => {
      const service = createService();
      await expect(
        service.enqueue("scoring", { companyId: "company-1", weightVersion: 1 }),
      ).resolves.toBeUndefined();
    });
  });

  describe("wrapProcessor", () => {
    it("validates the payload before calling the processor", async () => {
      const service = createService();
      const processor = async (_payload: any) => undefined;
      const wrapped = service.wrapProcessor("scoring", processor);

      await expect(wrapped({ companyId: "company-1" } as any)).rejects.toThrow(ValidationError);
    });

    it("calls the processor with the parsed payload", async () => {
      const service = createService();
      let received: any;
      const processor = async (payload: any) => {
        received = payload;
        return undefined;
      };
      const wrapped = service.wrapProcessor("scoring", processor);

      await wrapped({ companyId: "company-1", weightVersion: 1 } as any);
      expect(received.companyId).toBe("company-1");
      expect(received.weightVersion).toBe(1);
    });

    it("completes the job as skipped when the processor returns Skipped", async () => {
      const service = createService();
      let called = false;
      const processor = async () => {
        called = true;
        return new Skipped("already current");
      };
      const wrapped = service.wrapProcessor("scoring", processor);

      await wrapped({ companyId: "company-1", weightVersion: 1 } as any);
      expect(called).toBe(true);
    });
  });
});
