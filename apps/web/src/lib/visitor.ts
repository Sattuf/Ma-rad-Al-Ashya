/**
 * Anonymous, random visitor id used only to keep a guest in the same search-ranking
 * variant across visits (signed-in users are assigned by account). Not personal data.
 */
const KEY = 'marad_visitor_id';

export function visitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anonymous'; // storage blocked: still searchable, just not sticky
  }
}
