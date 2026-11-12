#!/bin/bash
# One daily catalog scrape. Run from cron so it does not share the API process.
set -euo pipefail
cd /opt/movies-server
export NODE_ENV=production
npm run pipeline
