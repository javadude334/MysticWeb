program MysticGateway;
{$mode objfpc}{$H+}
uses SysUtils;
const
  ExpectedRoot = 'E:\mystic';
  ExpectedRecordSize = 1536;
var
  Root, UsersPath, MysticPath, CanonicalRoot, Mode: string;
  Handle: THandle;
  Size: Int64;
begin
  { No listener, authentication, user data output, or writes. }
  if (ParamCount <> 1) or
     ((ParamStr(1) <> '--preflight') and (ParamStr(1) <> '--inspect-layout')) then
  begin
    WriteLn('MysticGateway diagnostic build; authentication and server disabled.');
    WriteLn('Usage: MysticGateway.exe --preflight | --inspect-layout');
    Halt(2);
  end;
  Mode := ParamStr(1);
  Root := ExcludeTrailingPathDelimiter(ExtractFilePath(ExpandFileName(ParamStr(0))));
  CanonicalRoot := ExcludeTrailingPathDelimiter(ExpandFileName(ExpectedRoot));
  if not SameText(Root, CanonicalRoot) then
  begin
    WriteLn('DENIED: diagnostics are restricted to E:\mystic.');
    Halt(3);
  end;
  MysticPath := IncludeTrailingPathDelimiter(Root) + 'mystic.exe';
  UsersPath := IncludeTrailingPathDelimiter(Root) + 'data' + PathDelim + 'users.dat';
  if (not FileExists(MysticPath)) or (not FileExists(UsersPath)) then
  begin
    WriteLn('DENIED: required Mystic sandbox files are missing.');
    Halt(4);
  end;
  if Mode = '--preflight' then
  begin
    WriteLn('PASS: sandbox root and required file paths exist.');
    WriteLn('Gateway features: disabled (preflight only).');
    Halt(0);
  end;
  { Metadata-only: open for read sharing, query length, never read a record. }
  Handle := FileOpen(UsersPath, fmOpenRead or fmShareDenyNone);
  if Handle = feInvalidHandle then
  begin
    WriteLn('DENIED: unable to open sandbox user file read-only.');
    Halt(5);
  end;
  try
    Size := FileSeek(Handle, Int64(0), fsFromEnd);
  finally
    FileClose(Handle);
  end;
  if (Size <= 0) or ((Size mod ExpectedRecordSize) <> 0) then
  begin
    WriteLn('DENIED: user file length is not aligned to the expected A48 record size.');
    Halt(6);
  end;
  WriteLn('PASS: A48 user file length is aligned to 1536-byte records.');
  WriteLn('Record slots: ', Size div ExpectedRecordSize);
  WriteLn('No user records or passwords were read. Authentication remains disabled.');
end.
