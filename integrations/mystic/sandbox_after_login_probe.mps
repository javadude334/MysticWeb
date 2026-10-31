// Temporary E: sandbox SSH entrypoint. Does not grant web access.
// The normal Mystic login checks complete before after_login.mpx runs.
// Preserve other protocol flows; never install over an existing login hook.
Begin
  If ServerType = 2 Then Begin
    MenuCmd('GY', 'mysticweb_context_probe');
    MenuCmd('GI', '');
  End;
End.
