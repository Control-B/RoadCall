#!/bin/bash

# Setup script for load testing
# Installs Artillery and verifies configuration

set -e

echo "=== Load Testing Setup ==="
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    echo "Please install Node.js and npm first"
    exit 1
fi

echo "✓ npm is installed"

# Check if Artillery is installed
if ! command -v artillery &> /dev/null; then
    echo "Artillery is not installed. Installing..."
    npm install -g artillery
    echo "✓ Artillery installed"
else
    echo "✓ Artillery is already installed"
    artillery --version
fi

# Install Artillery plugins
echo ""
echo "Installing Artillery plugins..."
npm install --save-dev artillery-plugin-expect artillery-plugin-metrics-by-endpoint

echo ""
echo "✓ Setup complete!"
echo ""
echo "You can now run load tests:"
echo "  ./run-load-test.sh dev quick"
echo "  ./run-load-test.sh staging full"
echo "  ./run-load-test.sh staging incidents"
