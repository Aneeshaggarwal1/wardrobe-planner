import { describe, expect, it } from "vitest";
import { checkPasscode, rateLimiter } from "../../lib/server/guard";
import { HttpError } from "../../lib/server/errors";

const req = (passcode?: string) =>
  new Request("http://x/api/tag", { method: "POST", headers: passcode === undefined ? {} : { "x-app-passcode": passcode } });

function status(fn: () => void): number | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
}

describe("checkPasscode", () => {
  it("lets the right passcode through", () => {
    expect(status(() => checkPasscode(req("open sesame"), "open sesame"))).toBeNull();
  });
  it("refuses a wrong or missing passcode", () => {
    expect(status(() => checkPasscode(req("guess"), "open sesame"))).toBe(401);
    expect(status(() => checkPasscode(req(), "open sesame"))).toBe(401);
  });
  it("refuses everything when the server has no passcode set", () => {
    expect(status(() => checkPasscode(req("anything"), undefined))).toBe(503);
    expect(status(() => checkPasscode(req(""), ""))).toBe(503);
  });
});

describe("rateLimiter", () => {
  it("allows up to the limit per window", () => {
    const hit = rateLimiter(2, 1000);
    expect(status(() => hit(0))).toBeNull();
    expect(status(() => hit(10))).toBeNull();
    expect(status(() => hit(20))).toBe(429);
    expect(status(() => hit(1001))).toBeNull();
  });
});
