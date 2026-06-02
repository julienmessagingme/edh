export interface MmEvent {
  name: string;
  event_ns: string;
  description: string;
  text_label: string;
  price_label: string;
  number_label: string;
}

export interface MmOccurrence {
  id: number;
  user_ns: string;
  event_ns: string;
  text_value: string;
  price_value: string;
  number_value: number;
  created_at: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { current_page: number; last_page: number };
}

export interface ClientOpts {
  token: string;
  base: string;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, init);
      // Retry only on 5xx (server errors / transient). 4xx are deterministic
      // (auth, rate-limit, bad params) — fail fast.
      if (r.status >= 500 && attempt < retries) {
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        continue;
      }
      return r;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

export async function listEvents(opts: ClientOpts): Promise<MmEvent[]> {
  const all: MmEvent[] = [];
  let page = 1;
  while (true) {
    const r = await fetchWithRetry(
      `${opts.base}/flow/custom-events?page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: "application/json",
        },
      }
    );
    if (!r.ok) {
      throw new Error(`listEvents failed: HTTP ${r.status} on page ${page}`);
    }
    const j = (await r.json()) as PaginatedResponse<MmEvent>;
    all.push(...j.data);
    if (j.meta.current_page >= j.meta.last_page) break;
    page++;
    // Hard safety net against infinite loops if API misbehaves.
    if (page > 200) {
      throw new Error("listEvents: pagination > 200 pages, aborting");
    }
  }
  return all;
}

/** Max occurrences per page — the API rejects anything above 100 (HTTP 422). */
const OCC_PAGE_SIZE = 100;

/**
 * Iterates occurrences of an event in ascending id order, using `start_id`
 * as an EXCLUSIVE cursor (the API returns rows with id strictly greater than
 * start_id). Pass `startId` to resume from a watermark; omit it for a full
 * scan from the beginning.
 *
 * The API returns rows oldest-first, so new occurrences land on the LAST
 * pages — never break early. We advance the cursor to the largest id seen in
 * each page and stop once a page comes back short (or empty), which means we
 * reached the tail.
 */
export async function* iterOccurrences(
  opts: ClientOpts,
  eventNs: string,
  startId?: number
): AsyncGenerator<MmOccurrence[], void, void> {
  let cursor = startId;
  let iterations = 0;
  while (true) {
    const params = new URLSearchParams({
      event_ns: eventNs,
      limit: String(OCC_PAGE_SIZE),
    });
    if (cursor != null) params.set("start_id", String(cursor));
    const url = `${opts.base}/flow/custom-events/data?${params.toString()}`;
    const r = await fetchWithRetry(url, {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: "application/json",
      },
    });
    if (!r.ok) {
      throw new Error(
        `iterOccurrences failed: HTTP ${r.status} on event ${eventNs} (start_id=${cursor ?? "none"})`
      );
    }
    const j = (await r.json()) as PaginatedResponse<MmOccurrence>;
    const batch = j.data;
    if (batch.length === 0) break;
    yield batch;

    const maxId = batch.reduce((m, o) => (o.id > m ? o.id : m), batch[0].id);
    // No-progress guard : if the cursor doesn't strictly advance the API is
    // misbehaving — bail rather than loop forever.
    if (cursor != null && maxId <= cursor) break;
    cursor = maxId;

    // A short page means we've consumed the tail.
    if (batch.length < OCC_PAGE_SIZE) break;

    if (++iterations > 100000) {
      throw new Error(
        `iterOccurrences: > 100000 pages on ${eventNs}, aborting`
      );
    }
  }
}
