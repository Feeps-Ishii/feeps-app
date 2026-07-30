@echo off
setlocal EnableExtensions

rem Restore the production frontend to a previous release.
rem   rollback.bat            - list restorable releases
rem   rollback.bat <RELEASE_ID> - restore that release (no rebuild needed)
rem
rem deploy.bat archives production to s3://feeps-app-releases/<RELEASE_ID>/ before each deploy,
rem so this only syncs it back. No build environment needed, so it works at any hour.

set "AWS_REGION=ap-northeast-1"
set "S3_BUCKET=feeps-app"
set "S3_RELEASES=feeps-app-releases"
set "CLOUDFRONT_DISTRIBUTION_ID=E2E41GI86GW1JM"
set "AWS_ARGS=--region %AWS_REGION%"
if not "%AWS_PROFILE%"=="" set "AWS_ARGS=--profile %AWS_PROFILE% --region %AWS_REGION%"

where aws >nul 2>nul
if errorlevel 1 (
  echo [rollback] ERROR: AWS CLI is not available in PATH.
  exit /b 1
)

if "%~1"=="" (
  echo [rollback] Restorable releases:
  aws %AWS_ARGS% s3 ls s3://%S3_RELEASES%/
  echo.
  echo [rollback] Usage: rollback.bat ^<RELEASE_ID^>
  echo [rollback]   e.g. rollback.bat 20260728-193000
  exit /b 0
)

set "RELEASE_ID=%~1"

aws %AWS_ARGS% s3 ls s3://%S3_RELEASES%/%RELEASE_ID%/index.html >nul 2>nul
if errorlevel 1 (
  echo [rollback] ERROR: release %RELEASE_ID% not found. Run without arguments to list releases.
  exit /b 1
)

echo [rollback] Restoring %RELEASE_ID%. The current production is archived first.
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "BEFORE_ID=%%T-before-rollback"
aws %AWS_ARGS% s3 sync s3://%S3_BUCKET% s3://%S3_RELEASES%/%BEFORE_ID%/ --quiet
if errorlevel 1 (
  echo [rollback] ERROR: could not archive the current production. Aborting.
  exit /b 1
)
echo [rollback] Archived: %BEFORE_ID%

aws %AWS_ARGS% s3 sync s3://%S3_RELEASES%/%RELEASE_ID%/ s3://%S3_BUCKET% --delete
if errorlevel 1 (
  echo [rollback] ERROR: restore failed. CloudFront invalidation was not started.
  exit /b 1
)

for /f "delims=" %%I in ('aws %AWS_ARGS% cloudfront create-invalidation --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --paths "/*" --query "Invalidation.Id" --output text') do set "INVALIDATION_ID=%%I"
if not defined INVALIDATION_ID (
  echo [rollback] ERROR: CloudFront invalidation failed. Files are restored but the CDN still serves the old version.
  exit /b 1
)
echo [rollback] CloudFront invalidation created: %INVALIDATION_ID%
aws %AWS_ARGS% cloudfront wait invalidation-completed --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --id %INVALIDATION_ID%
echo [rollback] CloudFront invalidation completed: %INVALIDATION_ID%
echo [rollback] Restored %RELEASE_ID%. Reload the browser to verify.
echo [rollback] NOTE: if the backend changed too, feeps-api must also be rolled back to the previous commit.
exit /b 0
