# JAM messaging

`src/lib/mystic/jam.ts` is bounded read-only. `src/lib/mystic/poster.ts` validates drafts and defines a native poster interface; **no native writer is connected**. Direct JAM appends risk locking, indexes, reply links and network export. Recover native behavior from ELF and verify on disposable sandbox copies before enabling posting. Recheck Post ACS independently.
