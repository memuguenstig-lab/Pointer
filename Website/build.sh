#!/bin/bash

echo "Building Next.js application..."
cd shadowide-website

# Ensure we're using the local next binary
NEXT_BIN="./node_modules/.bin/next"

# Build the application
$NEXT_BIN build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build completed successfully!"
else
    echo "Build failed!"
    exit 1
fi 