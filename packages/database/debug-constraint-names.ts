function constraintNames(error: unknown): string[] {
  const names: string[] = [];
  let candidate: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) {
      break;
    }

    const { constraint_name: name } = candidate as { constraint_name?: unknown };
    if (typeof name === "string") {
      names.push(name);
    }

    candidate = (candidate as { cause?: unknown }).cause;
  }

  return names;
}

const error = {
  "query": "update \"outreach\" set \"status\" = $1, \"sent_at\" = $2, \"sent_means\" = $3 where \"outreach\".\"id\" = $4",
  "params": ["sent", "2026-08-13T09:07:43.281Z", null, "019ffa60-9c29-78ae-8486-11b90778be9e"],
  "cause": {
    "name": "PostgresError",
    "severity_local": "ERROR",
    "severity": "ERROR",
    "code": "23514",
    "detail": "Failing row contains ...",
    "schema_name": "public",
    "table_name": "outreach",
    "constraint_name": "outreach_sent_means_required",
    "file": "execMain.c",
    "line": "2081",
    "routine": "ExecConstraints"
  }
};

console.log("constraintNames:", constraintNames(error));
