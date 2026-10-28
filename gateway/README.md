# MysticGateway prototype

This is **not** an authentication gateway yet. It compiles into one `MysticGateway.exe`, with no separate application runtime. It performs only a read-only existence check against the disposable `E:\mystic` installation when explicitly invoked with `--preflight`.

It does not open `users.dat`, process passwords, start a network listener, or modify files. Any invocation without `--preflight` exits nonzero. Any root other than the exact sandbox location exits nonzero. This strict restriction is intentional for the first diagnostic build; do not deploy to production.

GitHub Actions workflow `MysticGateway Windows diagnostic build` compiles on a hosted Windows runner and uploads a binary artifact if the build and fail-closed checks succeed. The workflow may need adjustment if the hosted runner's Free Pascal package layout changes. **Do not interpret a green build as native A48 authentication certification.**

Next: verify compiler/build artifact, run only in `E:\mystic`, then investigate supported standalone native password verification without inventing the password algorithm.
