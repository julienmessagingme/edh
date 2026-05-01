import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/schools/context", () => ({
  getCurrentSchoolSlug: vi.fn().mockResolvedValue("efap"),
  SCHOOL_COOKIE_NAME: "edh_school",
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn().mockResolvedValue({ userId: "u1", email: "a@b.c" }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-15T12:34:56Z"));
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
  process.env.AUTH_SECRET = "0".repeat(64);
  process.env.INTERNAL_API_KEY = "x";
});

afterEach(() => vi.useRealTimers());

interface OwnerData {
  id: string;
  created_by: string;
  school_slug: string;
  date_preset: string;
  date_from: string | null;
  date_to: string | null;
}

interface MockOpts {
  ownerData: OwnerData | null;
  steps?: Array<{
    id: string;
    position: number;
    step_type: "mm_event" | "url_click";
    event_ns: string | null;
    redirect_event_id: string | null;
  }>;
  mmLabels?: Array<{ event_ns: string; name: string }>;
  redirectLabels?: Array<{ id: string; name: string; school_slug: string }>;
  /** Returned by `mm_occurrences` count(*) head query, in order of step. */
  mmCounts?: number[];
  /** Returned by `clicks` count(*) head query, in order of step. */
  clickCounts?: number[];
}

function buildSupabaseMock(opts: MockOpts) {
  let mmCountIdx = 0;
  let clickCountIdx = 0;
  return {
    from: (table: string) => {
      if (table === "dashboards") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: opts.ownerData, error: null }),
            }),
          }),
        };
      }
      if (table === "dashboard_steps") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({ data: opts.steps ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "mm_events") {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({ data: opts.mmLabels ?? [], error: null }),
            }),
          }),
        };
      }
      if (table === "redirect_events") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({ data: opts.redirectLabels ?? [], error: null }),
          }),
        };
      }
      if (table === "mm_occurrences") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lt: () =>
                    Promise.resolve({
                      count: (opts.mmCounts ?? [])[mmCountIdx++] ?? 0,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "clicks") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () =>
                  Promise.resolve({
                    count: (opts.clickCounts ?? [])[clickCountIdx++] ?? 0,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("GET /api/dashboards/[id]/data", () => {
  it("404 when not owned", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      buildSupabaseMock({
        ownerData: {
          id: "d1",
          created_by: "OTHER",
          school_slug: "efap",
          date_preset: "30d",
          date_from: null,
          date_to: null,
        },
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/data/route");
    const res = await GET(new Request("http://x/api/dashboards/d1/data"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(404);
  });

  it("computes counts for mm_event + url_click in order, with conversion data", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      buildSupabaseMock({
        ownerData: {
          id: "d1",
          created_by: "u1",
          school_slug: "efap",
          date_preset: "30d",
          date_from: null,
          date_to: null,
        },
        steps: [
          {
            id: "s1",
            position: 0,
            step_type: "mm_event",
            event_ns: "evt_a",
            redirect_event_id: null,
          },
          {
            id: "s2",
            position: 1,
            step_type: "url_click",
            event_ns: null,
            redirect_event_id: "11111111-1111-4111-8111-111111111111",
          },
          {
            id: "s3",
            position: 2,
            step_type: "mm_event",
            event_ns: "evt_b",
            redirect_event_id: null,
          },
        ],
        mmLabels: [
          { event_ns: "evt_a", name: "Relance benin" },
          { event_ns: "evt_b", name: "Remplissage dossier" },
        ],
        redirectLabels: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Clic JPO",
            school_slug: "efap",
          },
        ],
        mmCounts: [1000, 100],
        clickCounts: [300],
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/data/route");
    const res = await GET(new Request("http://x/api/dashboards/d1/data"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      from: string;
      to: string;
      steps: Array<{
        position: number;
        step_type: string;
        ref_id: string;
        label: string;
        count: number;
        available: boolean;
      }>;
    };
    expect(body.from).toBe("2026-04-16");
    expect(body.to).toBe("2026-05-15");
    expect(body.steps).toHaveLength(3);
    expect(body.steps[0]).toMatchObject({
      position: 0,
      step_type: "mm_event",
      ref_id: "evt_a",
      label: "Relance benin",
      count: 1000,
      available: true,
    });
    expect(body.steps[1]).toMatchObject({
      position: 1,
      step_type: "url_click",
      label: "Clic JPO",
      count: 300,
      available: true,
    });
    expect(body.steps[2]).toMatchObject({
      position: 2,
      step_type: "mm_event",
      ref_id: "evt_b",
      label: "Remplissage dossier",
      count: 100,
      available: true,
    });
  });

  it("marks step as unavailable when source mm_event is missing", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      buildSupabaseMock({
        ownerData: {
          id: "d1",
          created_by: "u1",
          school_slug: "efap",
          date_preset: "7d",
          date_from: null,
          date_to: null,
        },
        steps: [
          {
            id: "s1",
            position: 0,
            step_type: "mm_event",
            event_ns: "evt_gone",
            redirect_event_id: null,
          },
        ],
        mmLabels: [], // not present anymore
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/data/route");
    const res = await GET(new Request("http://x/api/dashboards/d1/data"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      steps: Array<{ available: boolean; count: number; label: string }>;
    };
    expect(body.steps[0].available).toBe(false);
    expect(body.steps[0].count).toBe(0);
    expect(body.steps[0].label).toBe("(indisponible)");
  });

  it("marks redirect as unavailable when belongs to another school", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      buildSupabaseMock({
        ownerData: {
          id: "d1",
          created_by: "u1",
          school_slug: "efap",
          date_preset: "7d",
          date_from: null,
          date_to: null,
        },
        steps: [
          {
            id: "s1",
            position: 0,
            step_type: "url_click",
            event_ns: null,
            redirect_event_id: "11111111-1111-4111-8111-111111111111",
          },
        ],
        redirectLabels: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Foreign URL",
            school_slug: "icart", // not 'efap'
          },
        ],
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/data/route");
    const res = await GET(new Request("http://x/api/dashboards/d1/data"), {
      params: Promise.resolve({ id: "d1" }),
    });
    const body = (await res.json()) as {
      steps: Array<{ available: boolean; count: number }>;
    };
    expect(body.steps[0].available).toBe(false);
    expect(body.steps[0].count).toBe(0);
  });

  it("returns empty steps array when dashboard has none", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      buildSupabaseMock({
        ownerData: {
          id: "d1",
          created_by: "u1",
          school_slug: "efap",
          date_preset: "30d",
          date_from: null,
          date_to: null,
        },
        steps: [],
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/data/route");
    const res = await GET(new Request("http://x/api/dashboards/d1/data"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { steps: unknown[] };
    expect(body.steps).toEqual([]);
  });
});
