@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js не найден.
  echo Установите Node.js LTS с https://nodejs.org/ и запустите этот файл снова.
  pause
  exit /b 1
)

rem Завершить старые процессы этого проекта
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%~dp0'; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*'+$p+'*') -and ($_.Name -eq 'electron.exe' -or $_.Name -eq 'node.exe') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

rem Перенести устаревший dist
if exist "dist" (
  if exist "dist-old" rmdir /s /q "dist-old"
  ren "dist" "dist-old"
)

set ELECTRON_SKIP_BINARY_DOWNLOAD=1

if not exist "node_modules" (
  echo Установка зависимостей, подождите...
  call npm install
  if errorlevel 1 (
    echo Ошибка установки зависимостей.
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Загрузка Electron, подождите...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $u='https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-win32-x64.zip'; $z=$env:TEMP+'\electron.zip'; Invoke-WebRequest -Uri $u -OutFile $z; $d='%~dp0node_modules\electron\dist'; if (!(Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }; Expand-Archive -Path $z -DestinationPath $d -Force; '33.4.11' | Set-Content '%~dp0node_modules\electron\dist\version' -NoNewline; 'electron.exe' | Set-Content '%~dp0node_modules\electron\path.txt' -NoNewline"
  if errorlevel 1 (
    echo Ошибка загрузки Electron.
    pause
    exit /b 1
  )
)

if exist "start.vbs" (
  wscript //nologo start.vbs
) else (
  start /min "" npm start
)
exit /b 0