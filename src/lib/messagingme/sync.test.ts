import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/messagingme/client");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
  process.env.AUTH_SECRET = "0".repeat(64);
  process.env.INTERNAL_API_KEY = "x";
});

function occ(id: number) {
  return {
    id,
    user_ns: "u",
    event_ns: "ns1",
    text_value: "",
    price_value: "0",
    number_value: 1,
    created_at: "2026-04-01T00:00:00Z",
  };
}

describe("syncSchool watermark", () => {
  it("resumes from the watermark via start_id and inserts every page to the tail", async () => {
    const clientMod = await import("@/lib/messagingme/client");
    vi.spyOn(clientMod, "listEvents").mockResolvedValue([
      {
        name: "a",
        event_ns: "ns1",
        description: "",
        text_label: "",
        price_label: "",
        number_label: "",
      },
    ]);

    // The API yields ascending pages; new occurrences are on the LAST page.
    // The buggy version broke on page 1 and never saw 200/201. Every row must
    // now reach the DB.
    const iterSpy = vi
      .spyOn(clientMod, "iterOccurrences")
      .mockImplementation(async function* () {
        yield [occ(100), occ(150)];
        yield [occ(200), occ(201)];
      });

    const inserts: { id: number }[] = [];
    const upserts: { table: string; row: Record<string, unknown> }[] = [];

    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (t: string) => {
        if (t === "mm_events") {
          return {
            upsert: (rows: Record<string, unknown>) => {
              upserts.push({ table: t, row: rows });
              return Promise.resolve({ error: null });
            },
          };
        }
        if (t === "mm_occurrences") {
          return {
            upsert: (rows: { id: number }[]) => {
              for (const r of rows) inserts.push({ id: r.id });
              return Promise.resolve({ error: null });
            },
          };
        }
        if (t === "mm_sync_state") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { last_occurrence_id: 99 }, error: null }),
                }),
              }),
            }),
            upsert: (row: Record<string, unknown>) => {
              upserts.push({ table: t, row });
              return Promise.resolve({ error: null });
            },
          };
        }
        return {};
      },
    });

    const { syncSchool } = await import("./sync");
    await syncSchool(
      {
        slug: "efap",
        name: "EFAP",
        tokenEnv: "MM_TOKEN_EFAP",
        vectorStoreEnv: "OPENAI_VS_EFAP",
        logo: "/logos/efap.png",
      },
      "tok"
    );

    // Watermark 99 must be passed straight through as the exclusive start_id
    // (not 99 + 1), and every yielded occurrence ingested — no early break.
    expect(iterSpy).toHaveBeenCalledWith(
      expect.anything(),
      "ns1",
      99
    );
    expect(inserts.map((r) => r.id)).toEqual([100, 150, 200, 201]);

    // Watermark advanced to the max ingested id.
    const stateUpserts = upserts.filter((u) => u.table === "mm_sync_state");
    const watermarkUpdate = stateUpserts.find(
      (u) => u.row.last_occurrence_id === 201
    );
    expect(watermarkUpdate).toBeDefined();
  });

  it("does a full scan (start_id undefined) when there is no watermark", async () => {
    const clientMod = await import("@/lib/messagingme/client");
    vi.spyOn(clientMod, "listEvents").mockResolvedValue([
      {
        name: "a",
        event_ns: "ns1",
        description: "",
        text_label: "",
        price_label: "",
        number_label: "",
      },
    ]);
    const iterSpy = vi
      .spyOn(clientMod, "iterOccurrences")
      .mockImplementation(async function* () {
        yield [occ(1), occ(2)];
      });

    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (t: string) => {
        if (t === "mm_sync_state") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
            upsert: () => Promise.resolve({ error: null }),
          };
        }
        return { upsert: () => Promise.resolve({ error: null }) };
      },
    });

    const { syncSchool } = await import("./sync");
    await syncSchool(
      {
        slug: "efap",
        name: "EFAP",
        tokenEnv: "MM_TOKEN_EFAP",
        vectorStoreEnv: "OPENAI_VS_EFAP",
        logo: "/logos/efap.png",
      },
      "tok"
    );

    expect(iterSpy).toHaveBeenCalledWith(
      expect.anything(),
      "ns1",
      undefined
    );
  });
});
