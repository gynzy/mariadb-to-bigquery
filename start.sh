#!/bin/bash
set -e

if [ -z "$QUERY_LIMIT" ]; then
  echo "You need to set the environment variable QUERY_LIMIT."
  exit;
fi
if [ -z "$BQ_DATASET" ]; then
  echo "You need to set the environment variable BQ_DATASET."
  exit;
fi
if [ -z "$GCE_JSON" ]; then
  echo "You need to set the environment variable GCE_JSON."
  exit;
fi
if [ -z "$BQ_PROJECT_ID" ]; then
  echo "You need to set the environment variable BQ_PROJECT_ID."
  exit;
fi
if [ -z "$RDS_DATABASE" ]; then
  echo "You need to set the environment variable RDS_DATABASE."
  exit;
fi
if [ -z "$RDS_PASSWORD" ]; then
  echo "You need to set the environment variable RDS_PASSWORD."
  exit;
fi
if [ -z "$RDS_USER" ]; then
  echo "You need to set the environment variable RDS_USER."
  exit;
fi
if [ -z "$RDS_HOST" ]; then
  echo "You need to set the environment variable RDS_HOST."
  exit;
fi
if [ -z "$TABLES" ]; then
  echo "You need to set the environment variable TABLES (comma separated list of tables)."
  exit;
fi

cd ./app

echo $GCE_JSON > google-keyfile.json

npm run prod
