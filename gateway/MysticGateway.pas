program MysticGateway;
{$mode objfpc}{$H+}
uses SysUtils, Classes;
const
  ExpectedRoot = 'E:\mystic';
  ExpectedRecordSize = 1536;
var
  Root, UsersPath, MysticPath, CanonicalRoot, Mode: string;
  Handle: THandle;
  Size: Int64;
  Stream: TFileStream;
  Slot: LongInt;
  Slots: Int64;
  IdBytes: array[0..3] of Byte;
  IdValue: LongWord;
  Seen: TStringList;
  DuplicateCount, ZeroCount: Integer;
  Key: string;
begin
  { No listener, authentication, user data output, or writes. }
  if (ParamCount <> 1) or
     ((ParamStr(1) <> '--preflight') and (ParamStr(1) <> '--inspect-layout') and
      (ParamStr(1) <> '--inspect-identities')) then
  begin
    WriteLn('MysticGateway diagnostic build; authentication and server disabled.');
    WriteLn('Usage: MysticGateway.exe --preflight | --inspect-layout | --inspect-identities');
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
  Slots := Size div ExpectedRecordSize;
  WriteLn('PASS: A48 user file length is aligned to 1536-byte records.');
  WriteLn('Record slots: ', Slots);
  if Mode = '--inspect-layout' then
  begin
    WriteLn('No user records or passwords were read. Authentication remains disabled.');
    Halt(0);
  end;
  { Read ONLY the four-byte candidate ID at the beginning of each slot.
    This offset is provisional, not a certified A48 schema or account policy.
    Never emit actual IDs, names, flags, or credential material. }
  if Slots > High(LongInt) then
  begin
    WriteLn('DENIED: too many record slots for diagnostic.');
    Halt(8);
  end;
  Stream := TFileStream.Create(UsersPath, fmOpenRead or fmShareDenyNone);
  Seen := TStringList.Create;
  try
    Seen.Sorted := True;
    Seen.Duplicates := dupIgnore;
    DuplicateCount := 0;
    ZeroCount := 0;
    for Slot := 0 to LongInt(Slots) - 1 do
    begin
      Stream.Position := Slot * ExpectedRecordSize;
      if Stream.Read(IdBytes, SizeOf(IdBytes)) <> SizeOf(IdBytes) then
      begin
        WriteLn('DENIED: unable to read candidate record identifier.');
        Halt(7);
      end;
      IdValue := LongWord(IdBytes[0]) or (LongWord(IdBytes[1]) shl 8) or
                 (LongWord(IdBytes[2]) shl 16) or (LongWord(IdBytes[3]) shl 24);
      if IdValue = 0 then Inc(ZeroCount);
      Key := IntToHex(IdValue, 8);
      if Seen.IndexOf(Key) >= 0 then Inc(DuplicateCount)
      else Seen.Add(Key);
    end;
    WriteLn('Candidate identifier field: first four bytes, little-endian (unverified).');
    WriteLn('Zero-valued identifiers: ', ZeroCount);
    WriteLn('Repeated identifiers: ', DuplicateCount);
    WriteLn('No account identifiers or personal data were displayed.');
    WriteLn('Native password verification and account policy remain disabled.');
  finally
    Seen.Free;
    Stream.Free;
  end;
end.
