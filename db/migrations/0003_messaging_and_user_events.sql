-- 0003 — Messaging and personalization move from MongoDB to Postgres.
--
-- Table ownership (see 0001):
--   conversations, conversation_members, messages ... messaging-service
--   user_events ...................................... personalization-service
--
-- Design notes (the queries these serve are in the services; each is one index range scan):
--
-- * A conversation is between exactly two users. The pair is stored ordered
--   (user_low < user_high) under a UNIQUE constraint, so "get or create" is a single
--   INSERT … ON CONFLICT with no race and no duplicate conversations.
-- * Per-user state (unread count, read position, inbox ordering) lives in
--   conversation_members, one row per participant. The inbox is a range scan on
--   (user_id, last_activity_at DESC); no sort, no scan of messages.
-- * The last message is denormalized onto conversations, so listing the inbox never
--   touches the messages table.
-- * Read receipts are a position (last_read_message_id), not a flag per message:
--   "mark as read" updates one row instead of every unread message, and a message is
--   read when its id is ≤ the recipient's position.
-- * messages.id is a monotonic BIGINT identity: history pages by keyset
--   (conversation_id, id DESC), so page 1000 costs the same as page 1 (OFFSET would scan
--   and discard every earlier row).
-- * The primary key of messages is (conversation_id, id), deliberately with no index on
--   id alone. With one, "WHERE conversation_id = $1 ORDER BY id DESC LIMIT 50" can be
--   planned as a backward walk of that index filtering on conversation_id: fast when the
--   conversation is recent, a scan of millions of other messages when it is not (the
--   planner assumes matches are spread evenly). Here the only usable index is the right
--   one, and there is one index less to maintain on every insert.
-- * user_events is append-only and grows fastest: it is range-partitioned by month.
--   Recommendations read only recent months (partition pruning), and retention drops a
--   whole partition instead of running a huge DELETE that bloats the table.

-- ── messaging ──────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id           UUID REFERENCES listings(id) ON DELETE SET NULL,
  last_message_id      BIGINT,
  last_message_at      TIMESTAMPTZ,
  last_sender_id       UUID,
  last_message_preview VARCHAR(200),
  last_message_image   BOOLEAN NOT NULL DEFAULT false,
  blocked_by           UUID[] NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pair_ordered CHECK (user_low < user_high),
  CONSTRAINT conversations_pair_unique UNIQUE (user_low, user_high)
)
-- Updated on every message, but only non-indexed columns change: free space in each page
-- lets Postgres do HOT updates (no index writes, less bloat).
WITH (fillfactor = 90);

-- user_high has no index of its own through the UNIQUE (user_low, user_high); the FK
-- cascade on user deletion needs one.
CREATE INDEX idx_conversations_user_high ON conversations (user_high);

CREATE TABLE conversation_members (
  conversation_id      UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_activity_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_count         INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_read_message_id BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
)
-- "Mark as read" changes only unread_count / last_read_message_id (not indexed): HOT.
WITH (fillfactor = 80, autovacuum_vacuum_scale_factor = 0.05);

-- The inbox: WHERE user_id = $1 ORDER BY last_activity_at DESC, conversation_id DESC,
-- paged by keyset on the same columns.
CREATE INDEX idx_conversation_members_inbox
  ON conversation_members (user_id, last_activity_at DESC, conversation_id DESC);

CREATE TABLE messages (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         VARCHAR(2000) NOT NULL CHECK (btrim(content) <> ''),
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Also the history index: newest first is a backward scan of it.
  PRIMARY KEY (conversation_id, id)
);
-- FK cascade when a user is deleted.
CREATE INDEX idx_messages_sender ON messages (sender_id);

-- ── personalization ────────────────────────────────────────────────────────
CREATE TABLE user_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   VARCHAR(16) NOT NULL
               CHECK (event_type IN ('view', 'favorite', 'message', 'search', 'purchase')),
  listing_id   UUID,
  category_id  UUID,
  search_query VARCHAR(200),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(metadata) <= 4096),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A primary key on a partitioned table must include the partition key.
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Defined on the parent, created on every partition: "the latest events of one user".
CREATE INDEX idx_user_events_user_recent ON user_events (user_id, created_at DESC);

-- Safety net: rows land here only if a month's partition was not created in time.
CREATE TABLE user_events_default PARTITION OF user_events DEFAULT;

-- Creates this month's partition and the next `months_ahead` ones. Idempotent and safe
-- to call from several pods at once (advisory lock). personalization-service calls it at
-- startup and daily.
CREATE FUNCTION ensure_user_event_partitions(months_ahead INTEGER DEFAULT 2)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  month_start DATE;
  part_name   TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(727002);
  FOR i IN 0..months_ahead LOOP
    month_start := (date_trunc('month', now()) + make_interval(months => i))::date;
    part_name := format('user_events_y%sm%s', to_char(month_start, 'YYYY'), to_char(month_start, 'MM'));
    IF to_regclass(part_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF user_events FOR VALUES FROM (%L) TO (%L)',
        part_name, month_start, (month_start + INTERVAL '1 month')::date
      );
    END IF;
  END LOOP;
END;
$$;

-- Retention: detaches and drops whole monthly partitions older than `keep_months`.
-- Dropping a partition is instant and leaves no bloat, unlike DELETE.
CREATE FUNCTION prune_user_event_partitions(keep_months INTEGER DEFAULT 6)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff  DATE := (date_trunc('month', now()) - make_interval(months => keep_months))::date;
  part    RECORD;
  dropped INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(727002);
  FOR part IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = 'user_events'::regclass
      AND c.relname ~ '^user_events_y[0-9]{4}m[0-9]{2}$'
      AND to_date(substring(c.relname FROM 14 FOR 4) || substring(c.relname FROM 19 FOR 2), 'YYYYMM') < cutoff
  LOOP
    EXECUTE format('DROP TABLE %I', part.relname);
    dropped := dropped + 1;
  END LOOP;
  RETURN dropped;
END;
$$;

SELECT ensure_user_event_partitions();
