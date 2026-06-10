#!/bin/bash

echo "ReconGPT Setup Script"
echo "========================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit .env file with your configuration before running!"
else
    echo ".env file already exists"
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p storage/jobs
mkdir -p logs
mkdir -p frontend/src/pages
mkdir -p frontend/src/components

# Check if recon tools are installed
echo "Checking recon tools..."
tools=("subfinder" "httpx" "katana" "nuclei")
missing_tools=()

for tool in "${tools[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        missing_tools+=("$tool")
    fi
done

if [ ${#missing_tools[@]} -gt 0 ]; then
    echo "Missing tools: ${missing_tools[*]}"
    echo "   Install them from: https://github.com/projectdiscovery"
else
    echo "All recon tools are installed"
fi

echo ""
echo "To start ReconGPT:"
echo "   1. Edit .env with your configuration"
echo "   2. Run: docker-compose up -d"
echo "   3. Access API: http://localhost:8000/docs"
echo ""
echo "Setup complete!"
