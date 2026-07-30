@echo off
setlocal EnableExtensions

rem Run from this script's own folder. Without this, npm run build fails when
rem the caller's current directory is somewhere else.
cd /d "%~dp0"

set "AWS_REGION=ap-northeast-1"
set "S3_BUCKET=feeps-app"
set "CLOUDFRONT_DISTRIBUTION_ID=E2E41GI86GW1JM"
set "S3_RELEASES=feeps-app-releases"
set "AWS_ARGS=--region %AWS_REGION%"
if not "%AWS_PROFILE%"=="" set "AWS_ARGS=--profile %AWS_PROFILE% --region %AWS_REGION%"
if "%HOME%"=="" set "HOME=%USERPROFILE%"

where aws >nul 2>nul
if errorlevel 1 (
  echo [deploy] ERROR: AWS CLI is not installed or not available in PATH.
  exit /b 1
)

echo [deploy] AWS auth preflight...
aws %AWS_ARGS% sts get-caller-identity >nul 2>nul
if errorlevel 1 (
  echo [deploy] ERROR: AWS credentials are not available or expired.
  echo [deploy]        Set AWS_PROFILE for an existing profile, or refresh the existing AWS login, then retry.
  echo [deploy]        If this is running from PowerShell/Codex, export HOME first: $env:HOME=$HOME
  echo [deploy]        No build or S3 sync was started.
  exit /b 1
)

for /f "delims=" %%A in ('aws %AWS_ARGS% sts get-caller-identity --query "Account" --output text') do set "AWS_ACCOUNT=%%A"
if "%AWS_PROFILE%"=="" (
  echo [deploy] Auth OK. profile=default account=%AWS_ACCOUNT% region=%AWS_REGION%
) else (
  echo [deploy] Auth OK. profile=%AWS_PROFILE% account=%AWS_ACCOUNT% region=%AWS_REGION%
)

call npm run build
if errorlevel 1 (
  echo [deploy] ERROR: build failed. S3 sync was not started.
  exit /b 1
)

rem Archive the current production before overwriting it. rollback.bat can restore it with a single sync (no rebuild needed).
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "RELEASE_ID=%%T"
echo [deploy] Archiving current production to s3://%S3_RELEASES%/%RELEASE_ID%/ ...
aws %AWS_ARGS% s3 sync s3://%S3_BUCKET% s3://%S3_RELEASES%/%RELEASE_ID%/ --quiet
if errorlevel 1 (
  echo [deploy] ERROR: could not archive the current production. Aborting before any change.
  exit /b 1
)
echo [deploy] Archived. Rollback target: %RELEASE_ID%

aws %AWS_ARGS% s3 sync dist/ s3://%S3_BUCKET% --delete
if errorlevel 1 (
  echo [deploy] ERROR: S3 sync failed. CloudFront invalidation was not started.
  exit /b 1
)

set "INVALIDATION_ID="
for /f "delims=" %%I in ('aws %AWS_ARGS% cloudfront create-invalidation --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --paths "/*" --query "Invalidation.Id" --output text') do set "INVALIDATION_ID=%%I"
if "%INVALIDATION_ID%"=="" (
  echo [deploy] ERROR: CloudFront invalidation creation failed.
  exit /b 1
)

echo [deploy] CloudFront invalidation created: %INVALIDATION_ID%
aws %AWS_ARGS% cloudfront wait invalidation-completed --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --id %INVALIDATION_ID%
if errorlevel 1 (
  echo [deploy] ERROR: CloudFront invalidation did not complete.
  exit /b 1
)

echo [deploy] CloudFront invalidation completed: %INVALIDATION_ID%
echo [deploy] Frontend deploy completed.
