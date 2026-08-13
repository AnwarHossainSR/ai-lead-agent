const HEALTH_TIMEOUT_MS = 2000;

export interface HealthStatus {
  status: "healthy" | "degraded" | "unreachable";
  postgres?: "up" | "down";
  redis?: "up" | "down";
  error?: string;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    return { status: "degraded", error: "API_URL not configured" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const response = await fetch(`${apiUrl}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        status: "degraded",
        postgres: body?.details?.postgres?.status === "up" ? "up" : "down",
        redis: body?.details?.redis?.status === "up" ? "up" : "down",
      };
    }

    const body = await response.json();
    return {
      status: "healthy",
      postgres: body?.details?.postgres?.status === "up" ? "up" : "down",
      redis: body?.details?.redis?.status === "up" ? "up" : "down",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "degraded", error: "Health check timed out" };
    }
    return {
      status: "unreachable",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
