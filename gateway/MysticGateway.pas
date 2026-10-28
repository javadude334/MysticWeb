program MysticGateway;
{$mode objfpc}{$H+}
uses SysUtils, Classes;
const ExpectedRoot = 'E:\mystic';
var Root, UsersPath, MysticPath, CanonicalRoot: string;
    Stream: TFileStream;
begin
  { Diagnostic-only binary: no listener, login, record reads, or writes. }
  if (ParamCount <> 1) or (ParamStr(1) <> '--preflight') then
  begin
    WriteLn('MysticGateway preflight build; authentication and server disabled.');
    WriteLn('Usage: MysticGateway.exe --preflight');
    Halt(2);
  end;
  Root := ExcludeTrailingPathDelimiter(ExtractFilePath(ExpandFileName(ParamStr(0))));
  CanonicalRoot := ExcludeTrailingPathDelimiter(ExpandFileName(ExpectedRoot));
  if not SameText(Root, CanonicalRoot) then
  begin
    WriteLn('DENIED: preflight is restricted to E:\mystic.');
    Halt(3);
  end;
  MysticPath := IncludeTrailingPathDelimiter(Root) + 'mystic.exe';
  UsersPath := IncludeTrailingPathDelimiter(Root) + 'data' + PathDelim + 'users.dat';
  if (not FileExists(MysticPath)) or (not FileExists(UsersPath)) then
  begin
    WriteLn('DENIED: required Mystic sandbox files are missing.');
    Halt(4);
  end;
  { Check only metadata. Do not open or parse the user database. }
  Stream := nil;
  WriteLn('PASS: sandbox root and required file paths exist.');
  WriteLn('Gateway features: disabled (preflight only).');
end.
