import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service");
vi.mock("@/lib/schools/context", () => ({
  getCurrentSchoolSlug: vi.fn().mockResolvedValue("efap"),
  SCHOOL_COOKIE_NAME: "edh_school",
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn().mockResolvedValue({ userId: "u1", email: "a@b.c" }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
  process.env.AUTH_SECRET = "0".repeat(64);
  process.env.INTERNAL_API_KEY = "x";
});

/**
 * Builds a `from()` mock that responds with `ownerData` to the ownership check
 * (`select(...).eq('id',...).maybeSingle()`) and forwards everything else
 * to `extra` overrides keyed by the called method.
 */
function mockSupabase(opts: {
  ownerData: { id: string; created_by: string; school_slug: string } | null;
  fromOverrides?: Record<string, unknown>;
}) {
  const fromImpl = (table: string) => {
    if (opts.fromOverrides && opts.fromOverrides[table]) {
      return opts.fromOverrides[table];
    }
    // default ownership check shape, used both for `dashboards` lookups
    // before we deliberately override it.
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: opts.ownerData, error: null }),
        }),
      }),
    };
  };
  return { from: fromImpl };
}

describe("GET /api/dashboards/[id]", () => {
  it("404 when not owned by current user", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      mockSupabase({
        ownerData: { id: "d1", created_by: "OTHER", school_slug: "efap" },
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/route");
    const res = await GET(new Request("http://x/api/dashboards/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(404);
  });

  it("404 when dashboard belongs to another school", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      mockSupabase({
        ownerData: { id: "d1", created_by: "u1", school_slug: "icart" },
      })
    );

    const { GET } = await import("@/app/api/dashboards/[id]/route");
    const res = await GET(new Request("http://x/api/dashboards/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns dashboard + steps when owned", async () => {
    let dashboardsCall = 0;
    const fromImpl = (table: string) => {
      if (table === "dashboards") {
        dashboardsCall += 1;
        // 1st call = ownership probe (maybeSingle)
        if (dashboardsCall === 1) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: "d1", created_by: "u1", school_slug: "efap" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        // 2nd call = full select (single)
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "d1",
                    school_slug: "efap",
                    created_by: "u1",
                    name: "F1",
                    type: "funnel",
                    date_preset: "30d",
                    date_from: null,
                    date_to: null,
                    created_at: "x",
                    updated_at: "y",
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      // dashboard_steps
      return {
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: "s1",
                    position: 0,
                    step_type: "mm_event",
                    event_ns: "evt_a",
                    redirect_event_id: null,
                  },
                ],
                error: null,
              }),
          }),
        }),
      };
    };
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: fromImpl,
    });

    const { GET } = await import("@/app/api/dashboards/[id]/route");
    const res = await GET(new Request("http://x/api/dashboards/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dashboard: { steps: unknown[] } };
    expect(body.dashboard.steps).toHaveLength(1);
  });
});

describe("PATCH /api/dashboards/[id]", () => {
  it("400 on empty body", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      mockSupabase({
        ownerData: { id: "d1", created_by: "u1", school_slug: "efap" },
      })
    );

    const { PATCH } = await import("@/app/api/dashboards/[id]/route");
    const res = await PATCH(
      new Request("http://x/api/dashboards/d1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("404 when not owned", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      mockSupabase({
        ownerData: { id: "d1", created_by: "OTHER", school_slug: "efap" },
      })
    );

    const { PATCH } = await import("@/app/api/dashboards/[id]/route");
    const res = await PATCH(
      new Request("http://x/api/dashboards/d1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Renommed" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("updates name only (no steps replace)", async () => {
    const update = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (table: string) => {
        if (table === "dashboards") {
          // First call = ownership lookup (maybeSingle), then update.
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: "d1", created_by: "u1", school_slug: "efap" },
                    error: null,
                  }),
              }),
            }),
            update,
          };
        }
        return {};
      },
    });

    const { PATCH } = await import("@/app/api/dashboards/[id]/route");
    const res = await PATCH(
      new Request("http://x/api/dashboards/d1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Renommed" }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
    const arg = update.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.name).toBe("Renommed");
  });

  it("replaces steps atomically (delete then insert)", async () => {
    const deleteFn = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: (table: string) => {
        if (table === "dashboards") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: "d1", created_by: "u1", school_slug: "efap" },
                    error: null,
                  }),
              }),
            }),
            update,
          };
        }
        return { delete: deleteFn, insert: insertFn };
      },
    });

    const { PATCH } = await import("@/app/api/dashboards/[id]/route");
    const res = await PATCH(
      new Request("http://x/api/dashboards/d1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          steps: [
            { step_type: "mm_event", event_ns: "evt_a" },
            {
              step_type: "url_click",
              redirect_event_id: "11111111-1111-4111-8111-111111111111",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(200);
    expect(deleteFn).toHaveBeenCalled();
    expect(insertFn).toHaveBeenCalled();
    const rows = insertFn.mock.calls[0][0] as Array<{
      position: number;
      step_type: string;
      event_ns: string | null;
      redirect_event_id: string | null;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      position: 0,
      step_type: "mm_event",
      event_ns: "evt_a",
      redirect_event_id: null,
    });
    expect(rows[1]).toMatchObject({
      position: 1,
      step_type: "url_click",
      event_ns: null,
    });
  });

  it("400 on invalid step (mm_event without event_ns)", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      mockSupabase({
        ownerData: { id: "d1", created_by: "u1", school_slug: "efap" },
      })
    );

    const { PATCH } = await import("@/app/api/dashboards/[id]/route");
    const res = await PATCH(
      new Request("http://x/api/dashboards/d1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          steps: [{ step_type: "mm_event" }],
        }),
      }),
      { params: Promise.resolve({ id: "d1" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/dashboards/[id]", () => {
  it("404 when not owned", async () => {
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      mockSupabase({
        ownerData: { id: "d1", created_by: "OTHER", school_slug: "efap" },
      })
    );

    const { DELETE } = await import("@/app/api/dashboards/[id]/route");
    const res = await DELETE(new Request("http://x/api/dashboards/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes when owned", async () => {
    const deleteFn = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const { getSupabase } = await import("@/lib/supabase/service");
    (getSupabase as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: "d1", created_by: "u1", school_slug: "efap" },
                error: null,
              }),
          }),
        }),
        delete: deleteFn,
      }),
    });

    const { DELETE } = await import("@/app/api/dashboards/[id]/route");
    const res = await DELETE(new Request("http://x/api/dashboards/d1"), {
      params: Promise.resolve({ id: "d1" }),
    });
    expect(res.status).toBe(200);
    expect(deleteFn).toHaveBeenCalled();
  });
});
