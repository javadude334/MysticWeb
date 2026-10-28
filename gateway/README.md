# MysticGateway prototype

This is **not** an authentication gateway yet. It compiles into one `MysticGateway.exe`, with no separate application runtime. It performs only a read-only existence check against the disposable `E:\mystic` installation when explicitly invoked with `--preflight`.

With `--preflight` it checks file presence only. With `--inspect-layout` it opens the sandbox `data/users.dat` read-only to inspect file length and verify alignment to the expected 1,536-byte A48 record size; it does not read record contents. It never processes passwords, starts a network listener, or modifies files. Any invocation without one of these explicit diagnostic switches exits nonzero. Any root other than the exact sandbox location exits nonzero. This strict restriction is intentional for the first diagnostic build; do not deploy to production.

GitHub Actions workflow `MysticGateway Windows diagnostic build` compiles on a hosted Windows runner and uploads a binary artifact if the build and fail-closed checks succeed. The workflow may need adjustment if the hosted runner's Free Pascal package layout changes. **Do not interpret a green build as native A48 authentication certification.**

Next: build and test `--inspect-layout` in `E:\mystic`, then investigate supported standalone native password verification without inventing the password algorithm. A record-length check is not native schema or authentication certification.
