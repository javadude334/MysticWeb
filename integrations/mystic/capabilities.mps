// Compile-only check for native APIs. Not a login service or permission grant.
// Deliberately never calls ReferenceNativeFunctions at runtime.
Uses User

Procedure ReferenceNativeFunctions
Begin
  If CheckPW('') Then WriteLn('password function available')
  If ACS('%') Then WriteLn('ACS function available')
  If GetUser(0) Then WriteLn('user function available')
End

Begin
  WriteLn('Compile-only probe. No account or permission checks were performed.')
End.
