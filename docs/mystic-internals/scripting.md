# Scripting integration

Mystic changelog mentions `getmbase`, `getmbaseid`, `msg_open`, `msg_seek`, `msg_gethdr`, `msg_gettxt`, `msg_close` Python hooks. These are research leads, not a verified external permission-safe write API. Existing `integrations/mystic/browser_native_worker.py` began as a worker skeleton. Determine whether trusted in-session scripting can provide native ACS and posting; verify actual A48 capabilities before wiring.
