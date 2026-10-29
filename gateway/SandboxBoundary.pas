unit SandboxBoundary;
{$mode objfpc}{$H+}
interface
uses Windows, SysUtils;
type
  TSandboxBoundary = class
  private
    Handles: array of THandle;
  public
    function OpenChecked(const Path: string): THandle;
    destructor Destroy; override;
  end;
function ModulePath: string;
implementation
function FinalPathName(Handle: THandle; Buffer: PChar; Count, Flags: DWORD): DWORD;
  stdcall; external 'kernel32.dll' name 'GetFinalPathNameByHandleA';
function ModulePath: string;
var Buffer: array[0..32767] of Char; Count: DWORD;
begin
  Count := GetModuleFileName(0, @Buffer[0], Length(Buffer));
  if (Count = 0) or (Count >= Length(Buffer)) then
    raise Exception.Create('Cannot resolve executable module');
  SetString(Result, PChar(@Buffer[0]), Count);
end;
function TSandboxBoundary.OpenChecked(const Path: string): THandle;
var Full, Part: string; I, Last: Integer; H: THandle;
    Info: TByHandleFileInformation;
    Buffer: array[0..32767] of Char; Count: DWORD; Resolved: string;
begin
  Full := ExpandFileName(Path);
  if not (SameText(Full, 'E:\mystic') or
    SameText(Copy(Full, 1, 10), 'E:\mystic\')) then
    raise Exception.Create('Outside approved sandbox');
  { Pin each ancestor before traversing its child. No write/delete sharing:
    replacement and reparse mutation must fail while these handles are held. }
  Last := 1;
  Result := INVALID_HANDLE_VALUE;
  for I := 3 to Length(Full) + 1 do
    if (I > Length(Full)) or (Full[I] = '\') then
    begin
      if I = 3 then Part := Copy(Full, 1, 3)
      else Part := Copy(Full, 1, I - 1);
      if Length(Part) <= Last then Continue;
      Last := Length(Part);
      H := CreateFile(PChar(Part), GENERIC_READ, FILE_SHARE_READ, nil,
        OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS or FILE_FLAG_OPEN_REPARSE_POINT, 0);
      if H = INVALID_HANDLE_VALUE then
        raise Exception.Create('Cannot pin sandbox path component');
      SetLength(Handles, Length(Handles) + 1);
      Handles[High(Handles)] := H;
      if not GetFileInformationByHandle(H, Info) then
        raise Exception.Create('Cannot inspect sandbox path handle');
      if (Info.dwFileAttributes and FILE_ATTRIBUTE_REPARSE_POINT) <> 0 then
        raise Exception.Create('Reparse point denied');
      Count := FinalPathName(H, @Buffer[0], Length(Buffer), 0);
      if (Count = 0) or (Count >= Length(Buffer)) then
        raise Exception.Create('Cannot resolve pinned path');
      SetString(Resolved, PChar(@Buffer[0]), Count);
      if not SameText(Resolved, '\\?\' + Part) then
        raise Exception.Create('Resolved path differs from approved path');
      if (I <= Length(Full)) and
        ((Info.dwFileAttributes and FILE_ATTRIBUTE_DIRECTORY) = 0) then
        raise Exception.Create('Ancestor is not a directory');
      Result := H;
    end;
end;
destructor TSandboxBoundary.Destroy;
var I: Integer;
begin
  for I := High(Handles) downto 0 do CloseHandle(Handles[I]);
  inherited Destroy;
end;
end.
