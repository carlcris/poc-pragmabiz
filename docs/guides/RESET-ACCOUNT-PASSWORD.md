# Reset the Lato Rosie account password

Run the complete contents of `scripts/reset-lato-rosie-password.sql` as `postgres`
in the target project's Supabase SQL Editor. It requires `pgcrypto` installed in
the `extensions` schema.

The script updates the password hash and update timestamp for the existing,
non-deleted account `lato_rosie@yahoo.com`. Its atomic block raises an error and
rolls back if the update matches anything other than exactly one account.
It does not create accounts, confirm emails, or revoke existing sessions.

This direct SQL update bypasses Auth API password-policy checks. The SQL file
contains the requested temporary password; keep it out of committed migrations.

Supabase stores bcrypt hashes in `auth.users.encrypted_password`; see
[Supabase password security](https://supabase.com/docs/guides/auth/password-security).
