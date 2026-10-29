program BoundaryProbe;
{$mode objfpc}{$H+}
uses Windows, SysUtils, SandboxBoundary;
var Boundary: TSandboxBoundary; H, Writer: THandle;
begin
  if ParamCount <> 1 then Halt(2);
  Boundary := TSandboxBoundary.Create;
  try
    try
      H := Boundary.OpenChecked(ParamStr(1));
      if H = INVALID_HANDLE_VALUE then Halt(4);
      Writer := CreateFile(PChar(ParamStr(1)), GENERIC_WRITE,
        FILE_SHARE_READ or FILE_SHARE_WRITE or FILE_SHARE_DELETE, nil,
        OPEN_EXISTING, 0, 0);
      if Writer <> INVALID_HANDLE_VALUE then
      begin
        CloseHandle(Writer);
        Halt(5);
      end;
      WriteLn('PASS: pinned file rejects concurrent writer.');
    except
      on E: Exception do
      begin
        WriteLn('DENIED: ', E.Message);
        Halt(4);
      end;
    end;
  finally
    Boundary.Free;
  end;
end.
