@echo off
:: Wrapper para k6 que carga las variables de local.config.env automáticamente.
:: Uso: run-k6.bat test-carga-normal.js
::      run-k6.bat test-pico.js
setlocal

set "CONFIG=%~dp0local.config.env"
if not exist "%CONFIG%" (
  echo Error: local.config.env no encontrado.
  echo Crea el fichero y rellena los valores.
  exit /b 1
)

:: Leer variables del fichero (ignora lineas con # y lineas vacias)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%CONFIG%") do (
  if not "%%a"=="" if not "%%b"=="" (
    set "%%a=%%b"
  )
)

k6 run ^
  -e TEST_EMAIL=%SUPERADMIN_EMAIL% ^
  -e TEST_PASSWORD=%SUPERADMIN_PASSWORD% ^
  -e MFA_TYPE=totp ^
  -e TOTP_SECRET=%TOTP_SECRET% ^
  -e API_URL=%API_URL% ^
  -e SMTP4DEV_URL=%SMTP4DEV_URL% ^
  %*

endlocal
