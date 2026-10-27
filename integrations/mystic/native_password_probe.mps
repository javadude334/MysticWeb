// Manual runtime probe for an authenticated, non-admin test BBS session.
// No file, user or message writes. Never run with -u/-p command-line credentials.
Uses User
Var Candidate : String
Var Matches : Boolean

Begin
  GetThisUser
  If UserSec = 0 Then Begin
    WriteLn('Probe requires a validated native test session.')
    Halt
  End
  WriteLn('MYSTICWEB PASSWORD PROBE BEGIN')
  WriteLn('Enter this test account password using native masked input.')
  Candidate := Input(25, 25, 6, '')
  Matches := False
  If Length(Candidate) > 0 Then Matches := CheckPW(Candidate)
  Candidate := ''
  If Matches Then WriteLn('NATIVE_PASSWORD_MATCH: TRUE')
    Else WriteLn('NATIVE_PASSWORD_MATCH: FALSE')
  If ACS('^') Then WriteLn('NATIVE_TRUE_CHECK: TRUE')
    Else WriteLn('NATIVE_TRUE_CHECK: FALSE')
  If Not ACS('%') Then WriteLn('NATIVE_FALSE_CHECK: TRUE')
    Else WriteLn('NATIVE_FALSE_CHECK: FALSE')
  WriteLn('MYSTICWEB PASSWORD PROBE END')
End.
