import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("listEvents", () => {
  it("paginates and aggregates results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                name: "a",
                event_ns: "1",
                description: "",
                text_label: "",
                price_label: "",
                number_label: "",
              },
            ],
            meta: { current_page: 1, last_page: 2 },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                name: "b",
                event_ns: "2",
                description: "",
                text_label: "",
                price_label: "",
                number_label: "",
              },
            ],
            meta: { current_page: 2, last_page: 2 },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("./client");
    const r = await listEvents({ token: "t", base: "https://api.test/api" });
    expect(r.length).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.map((e) => e.event_ns)).toEqual(["1", "2"]);
  });

  it("throws on 4xx without retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("./client");
    await expect(
      listEvents({ token: "bad", base: "https://api.test/api" })
    ).rejects.toThrow(/HTTP 401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("oops", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [],
            meta: { current_page: 1, last_page: 1 },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const { listEvents } = await import("./client");
    const r = await listEvents({ token: "t", base: "https://api.test/api" });
    expect(r).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("iterOccurrences", () => {
  // Build a full page (length === OCC_PAGE_SIZE) of sequential ids starting at
  // `start`, so the cursor loop keeps paginating until it gets a short page.
  function fullPage(start: number) {
    return Array.from({ length: 100 }, (_, i) => ({ id: start + i }));
  }

  it("advances start_id as an exclusive cursor across full pages", async () => {
    const page1 = fullPage(1); // ids 1..100
    const page2 = [{ id: 101 }, { id: 102 }]; // short page → tail
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: page1, meta: {} }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: page2, meta: {} }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { iterOccurrences } = await import("./client");
    const collected: number[] = [];
    for await (const batch of iterOccurrences(
      { token: "t", base: "https://api.test/api" },
      "ns1",
      10
    )) {
      for (const r of batch) collected.push((r as { id: number }).id);
    }

    expect(collected.length).toBe(102);
    expect(collected[0]).toBe(1);
    expect(collected[collected.length - 1]).toBe(102);

    // First call carries the initial watermark; second call advances the
    // cursor to the max id of page 1 (100), proving it doesn't re-page.
    const url1 = fetchMock.mock.calls[0][0] as string;
    const url2 = fetchMock.mock.calls[1][0] as string;
    expect(url1).toContain("start_id=10");
    expect(url1).toContain("limit=100");
    expect(url2).toContain("start_id=100");
  });

  it("omits start_id for a full scan when none is given", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 1 }], meta: {} }), {
          status: 200,
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { iterOccurrences } = await import("./client");
    for await (const _ of iterOccurrences(
      { token: "t", base: "https://api.test/api" },
      "ns1"
    )) {
      void _;
    }
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("start_id");
  });

  it("stops on an empty first page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: {} }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const { iterOccurrences } = await import("./client");
    const collected: number[] = [];
    for await (const batch of iterOccurrences(
      { token: "t", base: "https://api.test/api" },
      "ns1",
      999
    )) {
      for (const r of batch) collected.push((r as { id: number }).id);
    }
    expect(collected).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
