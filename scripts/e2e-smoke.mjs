#!/usr/bin/env node
/**
 * رحلة كاملة عبر البوابة — End-to-end smoke test of a running stack.
 *
 * Plays the app's real journeys through the gateway, the way the web and mobile clients
 * call it: two users, a listing with an image, favorites, realtime chat over socket.io
 * (unread counts, read receipts, image message, delete, block), a deal from purchase to
 * review, personalization events and admin endpoints.
 *
 *   node scripts/e2e-smoke.mjs                         (stack from infra/docker-compose.yml)
 *   API_URL=http://192.168.1.20:3000/api/v1 SOCKET_URL=http://192.168.1.20:3004 node scripts/e2e-smoke.mjs
 *
 * Exits non-zero on the first failed check. Every run uses fresh users.
 */
import { deflateSync } from 'node:zlib';
import { io } from 'socket.io-client';

const API = (process.env.API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const SOCKET = process.env.SOCKET_URL || 'http://localhost:3004';
const run = Date.now().toString(36);
let passed = 0;

function check(condition, label, detail) {
  if (!condition) {
    console.error(`✗ ${label}${detail !== undefined ? `\n  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${label}`);
}

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const send = () => fetch(`${API}${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  let res = await send();
  // The gateway allows 20 credential requests a minute per address (anti brute-force);
  // back-to-back runs hit it. Respect Retry-After once instead of failing.
  if (res.status === 429 && path.startsWith('/auth/')) {
    const wait = Math.min(Number(res.headers.get('retry-after')) || 60, 65);
    console.log(`  (auth rate limit reached, waiting ${wait}s as the gateway asks)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await send();
  }
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, data };
}

/** A real 32×32 PNG (the services re-encode images with sharp, so it must decode). */
function pngImage() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const size = 32;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) rows.set([13, 148, 136], y * (1 + size * 3) + 1 + x * 3); // brand teal
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function imageForm(field) {
  const form = new FormData();
  form.append(field, new Blob([pngImage()], { type: 'image/png' }), 'photo.png');
  return form;
}

async function registerUser(name) {
  const email = `${name}.${run}@example.com`;
  const res = await call('POST', '/auth/register', { body: { email, fullName: name, password: 'Str0ng!Passw0rd' } });
  check(res.status === 201, `register ${name}`, res.data);
  const login = await call('POST', '/auth/login', { body: { identifier: email, password: 'Str0ng!Passw0rd' } });
  check(login.status === 200 || login.status === 201, `login ${name}`, login.data);
  return { id: login.data.user.id, email, token: login.data.tokens.access_token };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function nextEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no "${event}" within ${timeoutMs}ms`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function fetchImage(url, label) {
  const res = await fetch(url);
  const type = res.headers.get('content-type') ?? '';
  const bytes = (await res.arrayBuffer()).byteLength;
  check(res.status === 200 && type.startsWith('image/') && bytes > 100, `${label} loads (${type}, ${bytes} bytes)`, `${res.status} ${url}`);
}

// ── journey ────────────────────────────────────────────────────────────────
console.log(`API ${API}\nSOCKET ${SOCKET}\n`);
const health = await fetch(API.replace(/\/api\/v1$/, '') + '/health');
check(health.ok, 'gateway health');

const seller = await registerUser('seller');
const buyer = await registerUser('buyer');

const guestDenied = await call('POST', '/listings', { body: { title: 'x', description: 'y', price: 1 } });
check(guestDenied.status === 401, 'publishing requires sign-in', guestDenied.status);

const categories = await call('GET', '/categories');
check(Array.isArray(categories.data) && categories.data.length > 0, `categories are seeded (${categories.data?.length})`);
const category = categories.data.find((c) => c.slug === 'electronics')?.children?.[0] ?? categories.data[0];

const created = await call('POST', '/listings', {
  token: seller.token,
  body: { title: `جوال للتجربة ${run}`, description: 'بحالة ممتازة، مع الشاحن والعلبة.', price: 250, categoryId: category.id },
});
check(created.status === 201, 'seller publishes a listing', created.data);
const listingId = created.data.id;

const upload = await call('POST', `/listings/${listingId}/images`, { token: seller.token, form: imageForm('file') });
check(upload.status === 201, 'seller uploads a listing image', upload.data);
check(upload.data.imageUrl?.startsWith(API + '/media/listings/'), 'image URL goes through the gateway', upload.data.imageUrl);
await fetchImage(upload.data.imageUrl, 'listing image');
await fetchImage(upload.data.thumbnailUrl, 'listing thumbnail');

// The gateway caches public listing pages for 30 s by design; a fresh query string skips
// that cache so the check sees the listing published a moment ago.
const browse = await call('GET', `/listings?limit=20&fresh=${run}`);
const browseItems = browse.data?.data ?? browse.data?.items ?? browse.data;
check(browse.status === 200 && JSON.stringify(browseItems).includes(listingId), 'a guest sees the listing when browsing');
const detail = await call('GET', `/listings/${listingId}`);
check(detail.status === 200 && JSON.stringify(detail.data).includes('/media/listings/'), 'listing details include its image', detail.data);

// Ranked search (search profile: Elasticsearch + search-service). Skipped when not running.
const session = `smoke-${run}`;
// Indexing runs in the background after publishing: the listing becomes searchable within
// about a second (Elasticsearch refresh), so allow a few seconds before failing.
let searchRes = await call('GET', `/search?q=${encodeURIComponent('جوال')}&session_id=${session}&page=1&limit=10`);
for (let i = 0; i < 10 && searchRes.status === 200 && !searchRes.data.ids.includes(listingId); i++) {
  await new Promise((r) => setTimeout(r, 500));
  searchRes = await call('GET', `/search?q=${encodeURIComponent('جوال')}&session_id=${session}&page=1&limit=10`);
}
if (searchRes.status === 200) {
  check(searchRes.data.ids.includes(listingId), `ranked search finds the listing (variant ${searchRes.data.variant})`, searchRes.data);
  const click = await call('POST', '/search/track-click', {
    body: { query: 'جوال', listing_id: listingId, position: searchRes.data.ids.indexOf(listingId), variant: searchRes.data.variant, session_id: session },
  });
  check(click.data?.tracked === true, 'the click on a search result is counted for the A/B test', click.data);
  const forged = await call('POST', '/search/track-click', {
    body: { query: 'جوال', listing_id: listingId, position: 0, variant: searchRes.data.variant === 'A' ? 'B' : 'A', session_id: session },
  });
  check(forged.data?.tracked === false, 'a click claiming the other variant is rejected', forged.data);
} else {
  console.log(`- ranked search skipped (search profile not running: ${searchRes.status})`);
}

const fav = await call('POST', `/users/favorites/${listingId}`, { token: buyer.token });
check(fav.status === 201 || fav.status === 200, 'buyer adds it to favorites', fav.data);
const favs = await call('GET', '/users/favorites', { token: buyer.token });
check(JSON.stringify(favs.data).includes(listingId), 'favorites list contains it', favs.data);

// Chat: the seller's inbox is open (user room), the buyer opens the conversation.
const sellerSocket = await connect(seller.token);
const buyerSocket = await connect(buyer.token);
check(true, 'both users connect to chat with their access token');
const rejected = await connect('not-a-token').then(() => false, () => true);
check(rejected, 'chat refuses a connection without a valid token');

const conv = await call('POST', '/conversations', { token: buyer.token, body: { participants: [seller.id], listingId } });
check(conv.status === 201 && conv.data.otherUserId === seller.id, 'buyer opens a conversation with the seller', conv.data);
const again = await call('POST', '/conversations', { token: seller.token, body: { participants: [buyer.id] } });
check(again.data.id === conv.data.id, 'the same pair always gets the same conversation');

const joined = await buyerSocket.emitWithAck('join_conversation', { conversationId: conv.data.id });
check(joined?.joined === conv.data.id, 'buyer joins the conversation room', joined);

const inboxEvent = nextEvent(sellerSocket, 'new_message');
const sent = await buyerSocket.emitWithAck('send_message', { conversationId: conv.data.id, content: 'مرحباً، هل الجوال متوفر؟' });
check(sent?.id && sent.content === 'مرحباً، هل الجوال متوفر؟', 'buyer sends a message (acknowledged)', sent);
const received = await inboxEvent;
check(received.id === sent.id, 'seller receives it instantly in the open inbox');

const sellerInbox = await call('GET', '/conversations?limit=20', { token: seller.token });
const row = sellerInbox.data.data.find((c) => c.id === conv.data.id);
check(row?.unreadCount === 1 && row.lastMessage?.content === sent.content, 'seller inbox: 1 unread, last message shown', row);
const mobileInbox = await call('GET', '/messaging/conversations', { token: seller.token });
check(mobileInbox.data?.data?.some((c) => c.id === conv.data.id), 'mobile path /messaging/conversations works');

await sellerSocket.emitWithAck('join_conversation', { conversationId: conv.data.id });
const readEvent = nextEvent(buyerSocket, 'message_read');
sellerSocket.emit('mark_read', { conversationId: conv.data.id });
const read = await readEvent;
check(read.userId === seller.id && read.lastReadMessageId === sent.id, 'buyer is told the seller read up to the message', read);
const history = await call('GET', `/conversations/${conv.data.id}/messages?limit=20`, { token: buyer.token });
check(history.data.data[0]?.isRead === true, 'the message shows as read (✓✓)', history.data);
const sellerInboxAfter = await call('GET', '/conversations', { token: seller.token });
check(sellerInboxAfter.data.data.find((c) => c.id === conv.data.id)?.unreadCount === 0, 'seller unread count is back to 0');

const reply = nextEvent(buyerSocket, 'new_message');
await sellerSocket.emitWithAck('send_message', { conversationId: conv.data.id, content: 'نعم متوفر 👍' });
check((await reply).content === 'نعم متوفر 👍', 'buyer receives the reply instantly');

const imageMsg = await call('POST', `/conversations/${conv.data.id}/messages/image`, { token: buyer.token, form: imageForm('image') });
check(imageMsg.status === 201 && imageMsg.data.type === 'image', 'buyer sends an image in the chat', imageMsg.data);
await fetchImage(imageMsg.data.imageUrl, 'chat image');

const deletedEvent = nextEvent(sellerSocket, 'message_deleted');
const del = await call('DELETE', `/conversations/${conv.data.id}/messages/${imageMsg.data.id}`, { token: buyer.token });
check(del.status === 200, 'buyer deletes their message (within 5 minutes)', del.data);
check((await deletedEvent).messageId === imageMsg.data.id, 'seller is told the message was deleted');
const notMine = await call('DELETE', `/conversations/${conv.data.id}/messages/${sent.id}`, { token: seller.token });
check(notMine.status === 403, "seller cannot delete the buyer's message", notMine.status);

const outsider = await registerUser('outsider');
const spy = await call('GET', `/conversations/${conv.data.id}/messages`, { token: outsider.token });
check(spy.status === 403, 'another user cannot read the conversation', spy.status);

// Deal: buyer requests, seller confirms, buyer reviews.
const deal = await call('POST', '/transactions', { token: buyer.token, body: { listing_id: listingId, seller_id: seller.id } });
check(deal.status === 201, 'buyer requests to buy', deal.data);
const confirm = await call('POST', `/transactions/${deal.data.id}/confirm`, { token: seller.token });
check(confirm.status === 201 || confirm.status === 200, 'seller confirms the deal', confirm.data);
const buyerConfirm = await call('POST', `/transactions/${deal.data.id}/confirm`, { token: buyer.token });
check([200, 201, 400, 409].includes(buyerConfirm.status), `buyer confirmation answered (${buyerConfirm.status})`, buyerConfirm.data);
const dealState = await call('GET', `/transactions/${deal.data.id}`, { token: buyer.token });
check(dealState.status === 200, `deal status is "${dealState.data.status}"`, dealState.data);
const review = await call('POST', `/transactions/${deal.data.id}/reviews`, { token: buyer.token, body: { rating: 5, comment: 'بائع ممتاز' } });
check(review.status === 201, 'buyer reviews the seller', review.data);
const summary = await call('GET', `/users/${seller.id}/rating-summary`);
check(Number(summary.data?.averageRating ?? summary.data?.average_rating) === 5, "seller's rating is 5", summary.data);

// Personalization and blocking.
const event = await call('POST', '/events', { token: buyer.token, body: { eventType: 'favorite', listingId, categoryId: category.id } });
check(event.status === 201, 'a favorite is recorded as a personalization event', event.data);
const recs = await call('GET', '/recommendations?limit=5', { token: buyer.token });
check(recs.status === 200 && Array.isArray(recs.data.listings), `recommendations answer (${recs.data.based_on})`, recs.data);

const blocked = await call('POST', `/conversations/${conv.data.id}/block`, { token: seller.token });
check(blocked.data?.blocked === true, 'seller blocks the conversation', blocked.data);
// A refused send is not acknowledged; the gateway emits an "exception" event instead.
const refusal = nextEvent(buyerSocket, 'exception');
buyerSocket.emit('send_message', { conversationId: conv.data.id, content: 'hello?' });
check(/blocked/i.test((await refusal).message), 'the buyer is told the conversation is blocked');
const blockedMessages = await call('GET', `/conversations/${conv.data.id}/messages?limit=50`, { token: seller.token });
check(!blockedMessages.data.data.some((m) => m.content === 'hello?'), 'no message gets through after blocking');

sellerSocket.close();
buyerSocket.close();
console.log(`\nAll ${passed} checks passed.`);
process.exit(0);
