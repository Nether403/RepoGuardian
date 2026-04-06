import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";

describe("GET /health", () => {
  it("returns the current milestone health payload", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: "repo-guardian-api",
      stage: "milestone-5a-execution-planning",
      status: "ok"
    });
    expect(typeof response.body.timestamp).toBe("string");
  });
});
