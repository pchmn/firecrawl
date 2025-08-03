#! /bin/bash

version=${1:-latest}

echo "Deploying version: $version"

docker buildx build --platform linux/amd64 -t pchmn/playwright-service:$version . --push