# Provision the three Achlers administrators

Run the entire `scripts/provision-achlers-admin-users.sql` file in the Supabase SQL editor as `postgres`. It is standalone PostgreSQL and needs the existing application schema, Auth schema, and pgcrypto; no Node.js runner or new migration is required.

The accounts are `joannlavestrechen@yahoo.com`, `chanechen22@gmail.com`, and `chancechen312@gmail.com`. The supplied shared password from the earlier staff batch is embedded in the script and applies only to new accounts. New email accounts are confirmed without sending invitations. No names or employee records are inferred.

The script reuses the existing, non-deleted Admin role in company `1e10e2dd-655e-41e0-a508-edfd660a9bcf` and assigns it separately for every currently active business unit. It sets BU access to `admin`. It does not change the Admin role's permissions, grant Super Admin, grant access to other companies, or include inactive units. Rerun it to add access to newly created active units.

Main-Bulacan (`d69c52d5-6755-4e28-87e3-24c680a5897b`) is the initial default/current BU. Existing selections, passwords, profiles, and other role assignments remain intact. Missing default/current selections are initialized to Main-Bulacan. Conflicting existing accounts, missing or ambiguous Admin roles, empty Admin permissions, and missing scope fail the complete transaction.

The final result lists every assigned account/BU pair. All writes commit together. Change the final `COMMIT` to `ROLLBACK` for a preview. If an SQL editor leaves an aborted transaction open after failure, run `ROLLBACK` before retrying. This script creates no persistent functions or schema objects; generated types and client cache invalidation changes are unnecessary. Users should sign in after provisioning to load current permissions.
