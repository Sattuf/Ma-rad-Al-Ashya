/**
 * Anonymous, random visitor id used only to keep a guest in the same search-ranking
 * variant across visits (signed-in users are assigned by account). Not personal data.
 */
const KEY = 'marad_visitor_id';

// When storage is blocked (private mode, strict settings) each page load still gets its own
// random id; a shared constant would put every such visitor in one variant and bias the test.
let memoryId: string | null = null;

export function visitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}
