# Mystic message-base paths: live vs sandbox

These paths were confirmed from the SysOp's Mystic System Paths screens on 2026-11-03.

| Setting | Live BBS | Sandbox |
| --- | --- | --- |
| System Path | `D:\\mystic\\` | `E:\\mystic\\` |
| Data File Path | `D:\\mystic\\data\\` | `E:\\mystic\\data\\` |
| Message Base Path | **`D:\\mystic\\messages\\`** | **`E:\\mystic\\msgs\\`** |
| Inbound EchoMail | `D:\\mystic\\echomail\\in\\` | `E:\\mystic\\echomail\\in\\` |
| Outbound Primary | `D:\\mystic\\echomail\\out\\primary\\` | `E:\\mystic\\echomail\\out\\primary\\` |

## Implementation contract

- Never assume that the live and sandbox message-base directories have the same basename.
- Resolve the message-base root from the **selected Mystic installation's trusted configuration**, not browser input, hardcoded drive letters, or a guessed `msgs` / `messages` path.
- Existing `MessageReader` takes an explicitly supplied root; production composition must supply the correct trusted root for its instance.
- The native posting service must resolve the same installation-specific root and the area's trusted JAM basename, then independently enforce Post ACS and validate the reply parent.
- A copied sandbox base is **test data only**. Do not write to the live BBS message bases while developing or testing.
- These are Windows paths from screenshots, **not** evidence that the paths are mounted on the MysticWeb host or that a native writer has been activated.

## Next test fixture

Copy a disposable public JAM message area with synthetic messages and at least one reply. Keep `.jhr`, `.jdx`, `.jdt` together; include `.jlr` if available, plus the area's configuration. Avoid private mail and real personal messages.
