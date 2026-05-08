import { describe, it, expect, beforeEach } from "vitest";

describe("schools", () => {
  beforeEach(() => {
    process.env.MM_TOKEN_EFAP = "tok-efap";
    delete process.env.MM_TOKEN_3WA;
    process.env.OPENAI_VS_EFAP = "vs_efap_test";
    delete process.env.OPENAI_VS_3WA;
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
    // 'edh' n'est PAS une école (sentinelle de scope) → rejeté ici.
    expect(isValidSchoolSlug("edh")).toBe(false);
  });

  it("isValidScopeSlug accepts schools + 'edh' sentinel", async () => {
    const { isValidScopeSlug, EDH_SCOPE_SLUG, isEdhScope } = await import(
      "./schools"
    );
    expect(isValidScopeSlug("efap")).toBe(true);
    expect(isValidScopeSlug("edh")).toBe(true);
    expect(isValidScopeSlug("nope")).toBe(false);
    expect(isValidScopeSlug("")).toBe(false);
    expect(EDH_SCOPE_SLUG).toBe("edh");
    expect(isEdhScope("edh")).toBe(true);
    expect(isEdhScope("efap")).toBe(false);
  });

  it("getSchoolToken returns env value when set, undefined otherwise", async () => {
    const { getSchoolToken } = await import("./schools");
    expect(getSchoolToken("efap")).toBe("tok-efap");
    expect(getSchoolToken("3wa")).toBeUndefined();
    expect(getSchoolToken("does-not-exist")).toBeUndefined();
  });

  it("getSchoolVectorStoreId returns env value when set, undefined otherwise", async () => {
    const { getSchoolVectorStoreId } = await import("./schools");
    expect(getSchoolVectorStoreId("efap")).toBe("vs_efap_test");
    expect(getSchoolVectorStoreId("3wa")).toBeUndefined();
    expect(getSchoolVectorStoreId("does-not-exist")).toBeUndefined();
  });

  it("each school has both tokenEnv and vectorStoreEnv defined", async () => {
    const { SCHOOLS } = await import("./schools");
    for (const s of SCHOOLS) {
      expect(s.tokenEnv).toMatch(/^MM_TOKEN_/);
      expect(s.vectorStoreEnv).toMatch(/^OPENAI_VS_/);
    }
  });
});
