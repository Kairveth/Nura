@echo off
REM Lanzador para la tarea programada de Windows. Ejecuta la suite de seguridad diaria de Nura.
REM El codigo de salida (0 = todo OK, 1 = posible vulnerabilidad o error) lo recoge el Programador de tareas.
cd /d "%~dp0..\.."
node security\daily-scan\scan.mjs
exit /b %ERRORLEVEL%
