import { describe, expect, it } from "vitest";

import { JobService, Skipped, ValidationError } from "./job.service";
import { QueueService } from "./queue.service";

class FakeRedis {
  async ping(): Promise<string> {
    return "PONG";
  }
}

describe("JobService", () => {
  const createService = () => {
    const redis = new FakeRedis() as any;
    const queueService = new QueueService(redis);
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
      expect(() =>
        service.validatePayload("scoring", { companyId: "company-1" }),
      ).toThrow(/weightVersion/);
    });

    it("throws ValidationError for an unknown job type", () => {
      const service = createService();
      expect(() => service.validatePayload("unknown" as any, {})).toThrow(
        /Unknown job type/,
      );
    });
  });

  describe("enqueue", () => {
    it("refuses an invalid payload and writes nothing", async () => {
      const service = createService();
      await expect(
        service.enqueue("scoring", { companyId: "company-1" }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("wrapProcessor", () => {
    it("validates the payload before calling the processor", async () => {
      const service = createService();
      const processor = async (_payload: any, _job: any) => {};
      const wrapped = service.wrapProcessor("scoring", processor);

      const job = { data: { companyId: "company-1" } } as any;
      await expect(wrapped(job)).rejects.toThrow(ValidationError);
    });

    it("calls the processor with the parsed payload", async () => {
      const service = createService();
      let received: any;
      const processor = async (payload: any) => {
        received = payload;
      };
      const wrapped = service.wrapProcessor("scoring", processor);

      const job = { data: { companyId: "company-1", weightVersion: 1 } } as any;
      await wrapped(job);
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

      const job = { data: { companyId: "company-1", weightVersion: 1 } } as any;
      await wrapped(job);
      expect(called).toBe(true);
    });
  });
});
