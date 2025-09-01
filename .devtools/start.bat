@echo off
chcp 65001 > nul
title API Backend Installer
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       🚀 Instalando API Backend      ║
echo  ╚══════════════════════════════════════╝
echo.

REM -------------------------------
REM Cambiar a carpeta API (suponiendo que .devtools está dentro de /api/.devtools)
REM -------------------------------
cd ..

REM -------------------------------
REM Crear o copiar archivo .env si no existe
REM -------------------------------
if exist ".env" (
    echo Archivo .env ya existe en /api
) else (
    if exist ".env.example" (
        echo Copiando .env.example a .env en /api
        copy ".env.example" ".env"
    ) else (
        echo Creando .env base en /api
        (
        echo NODE_ENV=development
        echo PORT=3000
        ) > ".env"
    )
)

REM -------------------------------
REM Limpiar dependencias anteriores
REM -------------------------------
if exist node_modules (
    echo Eliminando carpeta node_modules...
    rmdir /S /Q node_modules
)

if exist package-lock.json (
    echo Eliminando package-lock.json...
    del /F /Q package-lock.json
)

REM -------------------------------
REM Instalar dependencias npm
REM -------------------------------
echo Ejecutando npm install...
npm install
if ERRORLEVEL 1 (
    echo ❌ Error durante npm install.
    goto ERROR
)

REM -------------------------------
REM Ejecutar script generate:key si existe
REM -------------------------------
echo Ejecutando npm run generate:key (si existe)...
npm run generate:key
if ERRORLEVEL 1 (
    echo ⚠️  Script generate:key no encontrado o error al ejecutarlo. Continuando...
)

REM -------------------------------
REM Finalización correcta y mensaje para iniciar servidor
REM -------------------------------
echo.
echo  ✅ API Backend instalado correctamente.
echo.
echo  📢 Para iniciar el servidor, ejecuta:
echo      node src/index.js
echo.
echo  (El servidor arrancará en el puerto 3500)
pause
exit /b 0

:ERROR
echo.
echo  ❌ Error durante la instalación del API Backend.
pause
exit /b 1
