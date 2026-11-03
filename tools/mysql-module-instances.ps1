#requires -Version 5.1
<#
  Per-module MySQL instances.

  Each module can run its own mysqld with its own data directory and its own
  TCP port, so a firewall rule can gate one database without touching the rest.
  Ports follow the MODULES order: 8301, 8302, ... 8319.

  Usage:
    .\tools\mysql-module-instances.ps1 -Action list
    .\tools\mysql-module-instances.ps1 -Action provision -Module central
    .\tools\mysql-module-instances.ps1 -Action start -Module central,cpa
    .\tools\mysql-module-instances.ps1 -Action stop  -Module central
    .\tools\mysql-module-instances.ps1 -Action status
#>
[CmdletBinding()]
param(
  [ValidateSet('list', 'provision', 'start', 'stop', 'status', 'remove')]
  [string]$Action = 'list',
  [string[]]$Module,
  [switch]$All,
  [int]$PortBase = 8300
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Module order mirrors server.py MODULES (port = base + index + 1).
$Modules = @(
  'central', 'cpa', 'credentials', 'gateways', 'communications', 'companies',
  'mm2_pss_expenses', 'mm2_inventory', 'mm2_account_service', 'mm2_cp_account_service',
  'mm2_company_expenses', 'mm2_account_statements', 'mm2_cpa_expenses', 'mm2_gate_visa',
  'mm2_fund_recovery', 'mm4_pss_requests', 'mm4_fund_transfers', 'mm4_manual_cpa',
  'mm4_auto_payment'
)

function Get-Port([string]$Name) {
  $index = [array]::IndexOf($Modules, $Name)
  if ($index -lt 0) { throw "Unknown module '$Name'. Known: $($Modules -join ', ')" }
  return $PortBase + $index + 1
}

function Read-EnvFile {
  $values = @{}
  $path = Join-Path $Root '.env'
  if (-not (Test-Path $path)) { return $values }
  foreach ($line in Get-Content $path) {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith('#') -or -not $trim.Contains('=')) { continue }
    $i = $trim.IndexOf('=')
    $values[$trim.Substring(0, $i).Trim()] = $trim.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
  return $values
}

$envCfg = Read-EnvFile
$MysqlBase = 'C:\Program Files\MySQL\MySQL Server 8.0'
$Mysqld = Join-Path $MysqlBase 'bin\mysqld.exe'
$Mysql = Join-Path $MysqlBase 'bin\mysql.exe'
if (-not (Test-Path $Mysqld)) { throw "mysqld.exe not found at $Mysqld" }

$DbUser = if ($envCfg['MM1_DB_USER']) { $envCfg['MM1_DB_USER'] } else { 'mm1_app' }
$DbPassword = $envCfg['MM1_DB_PASSWORD']
$DbPrefix = if ($envCfg['MM1_DB_NAME']) { $envCfg['MM1_DB_NAME'] } else { 'mm1_microfinance' }

function Get-DataDir([string]$Name) { Join-Path $Root "data\mysql\$Name" }

function Test-PortOpen([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect('127.0.0.1', $Port)
    $client.Close()
    return $true
  } catch { return $false }
}

function Wait-Port([int]$Port, [int]$Seconds = 45) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen $Port) { return $true }
    Start-Sleep -Milliseconds 700
  }
  return $false
}

function Initialize-Instance([string]$Name) {
  $dataDir = Get-DataDir $Name
  if (Test-Path (Join-Path $dataDir 'mysql')) { Write-Host "  data directory already initialised"; return }
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
  Write-Host "  initialising data directory $dataDir"
  & $Mysqld --initialize-insecure "--basedir=$MysqlBase" "--datadir=$dataDir" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "mysqld --initialize-insecure failed for $Name" }
}

function Start-Instance([string]$Name) {
  $port = Get-Port $Name
  $dataDir = Get-DataDir $Name
  if (Test-PortOpen $port) { Write-Host "  already listening on $port"; return }
  if (-not (Test-Path (Join-Path $dataDir 'mysql'))) { throw "$Name is not initialised. Run -Action provision -Module $Name" }
  Write-Host "  starting $Name on port $port"
  # Start-Process joins the list with spaces without quoting, and the project
  # path contains a space, so quote every path-valued argument.
  $args = @(
    "--datadir=`"$dataDir`"",
    "--port=$port",
    '--bind-address=127.0.0.1',
    '--mysqlx=0',
    "--log-error=`"$dataDir\error.log`"",
    "--pid-file=`"$dataDir\mysqld.pid`""
  )
  Start-Process -FilePath $Mysqld -ArgumentList $args -WindowStyle Hidden | Out-Null
  if (-not (Wait-Port $port 60)) { throw "$Name did not start on port $port (see $dataDir\error.log)" }
}

function Ensure-Database([string]$Name) {
  $port = Get-Port $Name
  $database = "$($DbPrefix)_$Name"
  $sql = @"
CREATE DATABASE IF NOT EXISTS ``$database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPassword';
CREATE USER IF NOT EXISTS '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPassword';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON ``$database``.* TO '$DbUser'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON ``$database``.* TO '$DbUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
  $sql | & $Mysql -h 127.0.0.1 -P $port -u root --protocol=TCP 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "could not create database/user on port $port" }
  Write-Host "  database $database ready, account $DbUser"
}

function Stop-Instance([string]$Name) {
  $port = Get-Port $Name
  $dataDir = Get-DataDir $Name
  if (-not (Test-PortOpen $port)) { Write-Host "  not running"; return }
  & (Join-Path $MysqlBase 'bin\mysqladmin.exe') -h 127.0.0.1 -P $port -u root --protocol=TCP shutdown 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  Write-Host "  stopped $Name (port $port)"
}

function Get-Status {
  foreach ($name in $Modules) {
    $port = Get-Port $name
    $up = Test-PortOpen $port
    [pscustomobject]@{
      Module = $name
      Port = $port
      Running = $up
      DataDir = (Get-DataDir $name)
      Initialised = (Test-Path (Join-Path (Get-DataDir $name) 'mysql'))
    }
  }
}

if ($All) { $targets = $Modules } elseif ($Module) { $targets = $Module } else { $targets = @() }

switch ($Action) {
  'list' {
    $Modules | ForEach-Object { '{0,-24} {1}' -f $_, (Get-Port $_) }
  }
  'status' { Get-Status | Format-Table -AutoSize }
  'provision' {
    if (-not $targets) { throw 'Use -Module <name>' }
    foreach ($name in $targets) {
      Write-Host "== $name (port $(Get-Port $name)) =="
      Initialize-Instance $name
      Start-Instance $name
      Ensure-Database $name
    }
  }
  'start' {
    if (-not $targets) { throw 'Use -Module <name>' }
    foreach ($name in $targets) { Write-Host "== $name =="; Start-Instance $name }
  }
  'stop' {
    if (-not $targets) { throw 'Use -Module <name>' }
    foreach ($name in $targets) { Write-Host "== $name =="; Stop-Instance $name }
  }
  'remove' {
    if (-not $targets) { throw 'Use -Module <name>' }
    foreach ($name in $targets) {
      Stop-Instance $name
      $dir = Get-DataDir $name
      if (Test-Path $dir) { Remove-Item $dir -Recurse -Force; Write-Host "  removed $dir" }
    }
  }
}
