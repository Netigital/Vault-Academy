@echo off
title Vault Academy Launcher
color 0A

set "BASE=%~dp0"
set "BACKEND=%BASE%backend"
set "FRONTEND=%BASE%frontend"

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "HOST_IP=%%i"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is required. Install Node.js LTS, then run this launcher again.
    pause
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found. Reinstall Node.js with npm included.
    pause
    exit /b 1
)

if not exist "%BACKEND%\node_modules" (
    echo Installing backend dependencies...
    pushd "%BACKEND%"
    call npm install
    if errorlevel 1 (
        popd
        echo ERROR: Backend dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

if not exist "%FRONTEND%\node_modules" (
    echo Installing frontend dependencies...
    pushd "%FRONTEND%"
    call npm install
    if errorlevel 1 (
        popd
        echo ERROR: Frontend dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

netsh advfirewall firewall show rule name="Vault Academy LAN" >nul 2>&1
if errorlevel 1 (
    net session >nul 2>&1
    if errorlevel 1 (
        echo Windows Firewall may block other devices from connecting.
        echo To allow LAN access, run this once in PowerShell as Administrator:
        echo   New-NetFirewallRule -DisplayName "Vault Academy LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5050,3001 -RemoteAddress LocalSubnet -Profile Private
    ) else (
        netsh advfirewall firewall add rule name="Vault Academy LAN" dir=in action=allow protocol=TCP localport=5050,3001 remoteip=LocalSubnet profile=private >nul
        if errorlevel 1 echo Could not add the Windows Firewall rule. See README.md for the administrator command.
    )
) else (
    netsh advfirewall firewall set rule name="Vault Academy LAN" new dir=in action=allow protocol=TCP localport=5050,3001 remoteip=LocalSubnet profile=private enable=yes >nul
    netsh advfirewall firewall add rule name="Vault Academy LAN - Block Public" dir=in action=block protocol=TCP localport=5050,3001 profile=public,domain >nul
)

echo Starting Vault Academy backend...
start "Vault Academy Backend" /min /D "%BACKEND%" cmd /k npm start
echo Starting Vault Academy frontend...
start "Vault Academy Frontend" /min /D "%FRONTEND%" cmd /k npm run dev

timeout /t 3 /nobreak >nul
start http://localhost:5050
echo.
echo Vault Academy is starting at http://localhost:5050
echo Backend API: http://localhost:3001
echo.
if defined HOST_IP (
    echo From another device on this Wi-Fi, open:
    echo   http://%HOST_IP%:5050
)
echo Keep the backend and frontend windows open while using the app.
pause
