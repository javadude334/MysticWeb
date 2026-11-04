# Authentication

Native account password verification and status checks are implemented and tested in MysticWeb, including PBKDF2-SHA512. `native-account-status.ts` rechecks locked/deleted candidate/password-change-required flags. `native-file-provider.ts` authenticates but does not grant message-area permissions. These are implementation and sandbox observations, **not yet binary-confirmed ACS behavior**. Do not archive user passwords or user databases.
