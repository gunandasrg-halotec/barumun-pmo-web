#!/bin/bash

# Exit immediately if any command fails
set -e
echo "Pulling latest code from Git..."
git pull origin main
docker compose -f staging-compose.yaml --env-file ./docker/staging/.env.example up  --build -d


echo "Application updated successfully!"

date > last_update.txt