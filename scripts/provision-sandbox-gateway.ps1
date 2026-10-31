# Create a new private certificate set for the authorized E: sandbox gateway.
# Never overwrite existing certificates; never print private key material.
$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if ($repoPath -ine 'E:\work\javadude_dev\MysticWeb') { throw 'Sandbox repository required' }
foreach ($part in @('E:\work','E:\work\javadude_dev',$repoPath)) {
  if ((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked repository path' }
}
$privateRoot = Join-Path $repoPath '.gateway'
if (Test-Path -LiteralPath $privateRoot) { throw 'Existing gateway configuration; refusing overwrite' }
$openssl = 'C:\DevApps\Git\usr\bin\openssl.exe'
if (-not (Test-Path -LiteralPath $openssl -PathType Leaf)) { throw 'Installed OpenSSL required' }
New-Item -ItemType Directory -Path $privateRoot | Out-Null
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $privateRoot /inheritance:r /grant:r ('*' + $ownerSid + ':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' *> $null
if ($LASTEXITCODE -ne 0) { throw 'Private directory ACL setup failed; no keys generated' }
function OpenSSL([string[]]$Arguments) {
  & $openssl @Arguments *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Certificate generation failed; preserve and inspect the private directory' }
}
Push-Location $privateRoot
try {
  @'
[req]
distinguished_name=dn
x509_extensions=ca
[dn]
CN=MysticWeb sandbox CA
[ca]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
'@ | Set-Content -LiteralPath 'ca.cnf' -Encoding Ascii
  @'
[req]
distinguished_name=dn
[dn]
CN=MysticWeb sandbox
'@ | Set-Content -LiteralPath 'request.cnf' -Encoding Ascii
  OpenSSL -Arguments @('req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-days','90',
    '-config','ca.cnf','-subj','/CN=MysticWeb sandbox CA','-keyout','ca.key','-out','ca.pem')
  foreach ($role in @('windows-gateway','ubuntu-client')) {
    OpenSSL -Arguments @('req','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-config','request.cnf',
      '-subj',('/CN=MysticWeb ' + $role),'-keyout',($role + '.key'),'-out',($role + '.csr'))
    $usage = if ($role -eq 'windows-gateway') { 'serverAuth' } else { 'clientAuth' }
    $extensions = @('basicConstraints=critical,CA:FALSE','keyUsage=critical,digitalSignature',('extendedKeyUsage=' + $usage))
    if ($role -eq 'windows-gateway') { $extensions += 'subjectAltName=IP:192.168.150.58' }
    $extensions | Set-Content -LiteralPath ($role + '.ext') -Encoding Ascii
    OpenSSL -Arguments @('x509','-req','-in',($role + '.csr'),'-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','30',
      '-extfile',($role + '.ext'),'-out',($role + '.pem'))
  }
  $certificateRoot = $privateRoot.Replace('\','/')
  @(
    'MYSTIC_GATEWAY_INSTANCE=mystic-sandbox',
    'MYSTIC_GATEWAY_BIND_ADDRESS=192.168.150.58',
    'MYSTIC_GATEWAY_PORT=8744',
    'MYSTIC_GATEWAY_ALLOWED_CLIENT=192.168.150.66',
    ('MYSTIC_GATEWAY_CA_FILE=' + $certificateRoot + '/ca.pem'),
    ('MYSTIC_GATEWAY_CERT_FILE=' + $certificateRoot + '/windows-gateway.pem'),
    ('MYSTIC_GATEWAY_KEY_FILE=' + $certificateRoot + '/windows-gateway.key')
  ) | Set-Content -LiteralPath 'windows.env' -Encoding Ascii
  Write-Output 'SANDBOX_GATEWAY_CERTIFICATES: CREATED; PRIVATE_ACL_APPLIED'
  Write-Output 'NATIVE_AUTHENTICATION: NOT_ENABLED'
} finally { Pop-Location }
