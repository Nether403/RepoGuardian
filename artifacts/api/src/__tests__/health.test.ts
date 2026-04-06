import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";

describe("GET /health", () => {
  it("returns the scaffold health payload", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: "repo-guardian-api",
      stage: "prompt-1-foundation",
      status: "ok"
    });
    expect(typeof response.body.timestamp).toBe("string");
  });
});
