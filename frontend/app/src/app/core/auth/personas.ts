import { Persona } from '../models';

/** Demo identities. Ids match the backend's seeded `DemoPersonas`. This is not production authentication. */
export const PERSONAS: readonly Persona[] = [
  {
    id: 'usr-staff-01',
    name: 'Elena Vance',
    role: 'Staff',
    title: 'Systems Administrator',
    blurb: 'Uploads documents and corrects extracted fields.',
  },
  {
    id: 'usr-mgr-01',
    name: 'Sarah Connor',
    role: 'Manager',
    title: 'Operations Director',
    blurb: 'Level 1 operational review.',
  },
  {
    id: 'usr-fin-01',
    name: 'David Sterling',
    role: 'Finance',
    title: 'Chief Financial Officer',
    blurb: 'Level 2 financial approval and disbursement.',
  },
  {
    id: 'usr-audit-01',
    name: 'Morgan Hayes',
    role: 'Auditor',
    title: 'Senior Compliance Auditor',
    blurb: 'Read-only access to everything, including the audit ledger.',
  },
];

export const DEFAULT_PERSONA_ID = PERSONAS[0].id;
