@echo off
if "%~1"=="" (
  git add . && git commit -m "update %date% %time%" && git push
) else (
  git add . && git commit -m %1 && git push
)