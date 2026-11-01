@echo off
set PORT=%ZS_HERMES_PORT%
if "%PORT%"=="" set PORT=17614

echo =================================================================
echo  Starting Cloudflare Quick Tunnel for WebLlmBridge
echo  Local Target: http://127.0.0.1:%PORT%
echo =================================================================

where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: 'cloudflared.exe' is not found in your PATH.
    echo Download from: https://github.com/cloudflare/cloudflared/releases
    pause
    exit /b 1
)

echo Copy the https://*.trycloudflare.com URL below to your Hermes config.yaml
echo Example: https://xxxx-xxxx.trycloudflare.com/v1
echo -----------------------------------------------------------------

cloudflared tunnel --url http://127.0.0.1:%PORT%
