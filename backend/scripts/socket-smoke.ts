// Checks the real-time side end to end: handshake auth, message delivery both ways, typing.
// The server must be running with LOS_PUBLIC_KEY_PATH=keys/dev-los-public.pem.
//
//   pnpm run smoke:socket
//   API_BASE_URL=http://localhost:3100 pnpm run smoke:socket
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { signDevToken } from './lib/dev-tokens.js';

const base = process.env.API_BASE_URL ?? 'http://localhost:3000';

let failures = 0;
const check = (name: string, pass: boolean) => {
  if (!pass) failures += 1;
  process.stdout.write(`${pass ? '✓' : '✗'} ${name}\n`);
};

const api = async (path: string, token: string, init: { method?: string; body?: unknown } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
  const json = (await res.json()) as { data?: any };
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
};

// * LOS token → chat session, the same exchange the apps do
const exchange = async (path: string, body: Record<string, string>) => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return ((await res.json()) as { data: { accessToken: string; user: { id: string } } }).data;
};

const connect = (token: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = io(base, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });

const waitFor = <T = any>(socket: Socket, event: string, match: (payload: T) => boolean = () => true, ms = 3000) =>
  new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    const handler = (payload: T) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });

const rejects = (token: string) =>
  connect(token).then(
    (s) => (s.disconnect(), false),
    () => true,
  );

// * LOS ids are 32-bit ints, so keep generated ids below 2^31
const run = Date.now() % 100_000_000;
const losCustomerToken = await signDevToken('customer', { user: 1_500_000_000 + run, name: `smoke-${run}` });
const customerToken = (await exchange('/customer/api/v1/auth/session', { losToken: losCustomerToken })).accessToken;
const staffA = await exchange('/agent/api/v1/auth/session', {
  handoffToken: await signDevToken('handoff', { user: 900_002, name: 'test-staff-a', role: 'CREDIT_SUPPORT_OFFICER' }),
});
const staffB = await exchange('/agent/api/v1/auth/session', {
  handoffToken: await signDevToken('handoff', { user: 900_003, name: 'test-staff-b', role: 'ACCOUNTANT_AR' }),
});

check('handshake rejects a bad token', await rejects('not-a-token'));
check('handshake rejects a raw LOS token (chat sessions only)', await rejects(losCustomerToken));

const customer = await connect(customerToken);
const staffASocket = await connect(staffA.accessToken);
const staffBSocket = await connect(staffB.accessToken);
check('customer and two staff members connect', customer.connected && staffASocket.connected && staffBSocket.connected);

// * Customer writes → every staff member receives it
const atA = waitFor(staffASocket, 'message:new', (m: any) => m.sender.type === 'CUSTOMER');
const atB = waitFor(staffBSocket, 'message:new', (m: any) => m.sender.type === 'CUSTOMER');
const ownEcho = waitFor(customer, 'message:new', (m: any) => m.sender.type === 'CUSTOMER');
const sent = await api('/customer/api/v1/chat/conversation/messages', customerToken, {
  method: 'POST',
  body: { clientMessageId: randomUUID(), type: 'TEXT', text: 'Hello from the socket smoke test' },
});
check('staff A receives message:new', (await atA)?.id === sent.id);
check('staff B receives message:new', (await atB)?.id === sent.id);
check('customer receives own message:new', (await ownEcho)?.id === sent.id);

// * Typing goes both ways
const customerSeesTyping = waitFor(customer, 'typing', (p: any) => p.user.id === staffA.user.id);
staffASocket.emit('typing', { conversationId: sent.conversationId, isTyping: true });
check('customer sees staff typing', !!(await customerSeesTyping));
const staffSeesTyping = waitFor(staffBSocket, 'typing', (p: any) => p.conversationId === sent.conversationId);
customer.emit('typing', { isTyping: true });
check('staff see the customer typing', !!(await staffSeesTyping));

// * Any staff member replies → the customer and the other staff get it live
const reply = waitFor(customer, 'message:new', (m: any) => m.sender.type === 'STAFF');
const otherStaffSees = waitFor(staffASocket, 'message:new', (m: any) => m.sender.type === 'STAFF');
await api(`/agent/api/v1/chat/conversations/${sent.conversationId}/messages`, staffB.accessToken, {
  method: 'POST',
  body: { clientMessageId: randomUUID(), type: 'TEXT', text: 'Hi, how can I help?' },
});
check('customer receives the staff reply', !!(await reply));
check('other staff see the reply', !!(await otherStaffSees));

for (const socket of [customer, staffASocket, staffBSocket]) socket.disconnect();
process.stdout.write(failures === 0 ? '\nAll socket checks passed\n' : `\n${failures} socket check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
