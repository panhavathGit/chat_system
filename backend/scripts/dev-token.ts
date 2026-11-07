// Dev only: prints one LOS-shaped token signed with the dev key.
//
//   pnpm run dev:token customer --user 101 --name sokha
//   pnpm run dev:token handoff  --user 201 --name dara --role CREDIT_SUPPORT_OFFICER
//   options: --expired (already expired), --aud <audience> (override), --type <tokenType> (override)
import { parseArgs } from 'node:util';
import { signDevToken } from './lib/dev-tokens.js';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: 'string', default: '1' },
    name: { type: 'string', default: 'dev-user' },
    role: { type: 'string', default: 'CREDIT_SUPPORT_OFFICER' },
    aud: { type: 'string' },
    type: { type: 'string' },
    expired: { type: 'boolean', default: false },
  },
});

const kind = positionals[0];
if (kind !== 'customer' && kind !== 'handoff') {
  process.stderr.write('Usage: dev-token <customer|handoff> [--user N] [--name X] [--role ROLE] [--expired]\n');
  process.exit(1);
}

const token = await signDevToken(kind, {
  user: Number(values.user),
  name: values.name,
  role: values.role,
  expired: values.expired,
  ...(values.aud && { aud: values.aud }),
  ...(values.type && { tokenType: values.type }),
});
process.stdout.write(`${token}\n`);
