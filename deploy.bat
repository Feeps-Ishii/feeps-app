@echo off
npm run build && aws s3 sync dist/ s3://feeps-app --delete && aws cloudfront create-invalidation --distribution-id E2E41GI86GW1JM --paths "/*"