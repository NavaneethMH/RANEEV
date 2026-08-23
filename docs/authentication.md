# RANEEV Authentication and Authorization

RANEEV uses the managed Manus application backend and database with **custom, password-based credentials**. It does not use Supabase Auth or a paid third-party authentication service. Passwords are validated server-side, converted to a random-salt scrypt hash, and never returned through tRPC responses or stored in plaintext. Sessions are signed JWTs held only in an HttpOnly cookie; the server validates the signature, expiration, subject, session version, and active profile status before it creates the request context.

The authenticated user is resolved once per request and server procedures then enforce explicit role and record-level authorization. Public registration can create only `citizen` or `volunteer` accounts. `coordinator` and `admin` remain server-managed roles. A standard profile update accepts only name and phone; role changes are available only to an administrator and cannot target that administrator’s own active account. The incident route applies a second ownership check: citizens may read only their own incidents, volunteers only their assigned incidents, while coordinators and administrators can access operational incidents.

## Development demo accounts

These fake accounts are seeded only when the application runs outside production. They use the `raneev.test` domain and synthetic phone numbers.

| Role | Email | Password |
|---|---|---|
| Citizen | `citizen.demo@raneev.test` | `Raneev!Citizen26` |
| Volunteer | `volunteer.demo@raneev.test` | `Raneev!Volunteer26` |
| Coordinator | `coordinator.demo@raneev.test` | `Raneev!Coord26` |
| Admin | `admin.demo@raneev.test` | `Raneev!Admin26` |

The credential/session logic lives behind `server/auth/credentials.ts`, so a future identity provider can replace the registration/login adapter without rewriting RANEEV role and incident authorization policies.

## Verification record

The backend replacement was verified with `pnpm check` and eight Vitest checks covering password validation and hashing, correct and incorrect credential verification, logout cookie clearing, role checks, incident ownership rules, and role-escalation prevention. Live tRPC smoke tests confirmed that each documented role receives its matching role claim and can access only its matching protected procedure. A Citizen session received `403` for the Admin procedure; a second Citizen received `403` when requesting an incident created by the first; and an Admin received `403` when attempting to change its own role.

The existing public landing, login, registration, and role-selection screens were captured at desktop and mobile breakpoints after the backend upgrade and retained their established Clinical Wayfinding visuals, layout, navigation labels, and responsive composition. The protected workspace components were not restyled or structurally changed: authorization now evaluates before the existing shell renders, and the visually identical profile avatar also clears the server session when activated.
