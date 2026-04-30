import { describe, it, expect, beforeEach } from "vitest";

describe("schools", () => {
  beforeEach(() => {
    process.env.MM_TOKEN_EFAP = "tok-efap";
    delete process.env.MM_TOKEN_3WA;
  });

  it("exposes 9 schools", async () => {
    const { SCHOOLS } = await import("./schools");
    expect(SCHOOLS.length).toBe(9);
    expect(SCHOOLS[0].slug).toBe("efap");
  });

  it("isValidSchoolSlug accepts known slugs only", async () => {
    const { isValidSchoolSlug } = await import("./schools");
    expect(isValidSchoolSlug("efap")).toBe(true);
    expect(isValidSchoolSlug("ecole-bleue")).toBe(true);
    expect(isValidSchoolSlug("nope")).toBe(false);
    expect(isValidSchoolSlug("")).toBe(false);
  });

  it("getSchoolToken returns env value when set, undefined otherwise", async () => {
    const { getSchoolToken } = await import("./schools");
    expect(getSchoolToken("efap")).toBe("tok-efap");
    expect(getSchoolToken("3wa")).toBeUndefined();
    expect(getSchoolToken("does-not-exist")).toBeUndefined();
  });
});
