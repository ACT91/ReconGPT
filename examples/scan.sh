#!/bin/bash
# ReconGPT Bash Example

API_BASE="http://localhost:8000/api/v1"
USER_ID="test-user"

echo "Starting ReconGPT scan..."

# Start scan
RESPONSE=$(curl -s -X POST "$API_BASE/scan/start" \
  -H "Content-Type: application/json" \
  -d "{\"target_domain\": \"$1\", \"user_id\": \"$USER_ID\"}")

JOB_ID=$(echo $RESPONSE | jq -r '.job_id')
echo "Scan started: $JOB_ID"

# Monitor progress
while true; do
  STATUS=$(curl -s "$API_BASE/scan/$JOB_ID" | jq -r '.status')
  PROGRESS=$(curl -s "$API_BASE/scan/$JOB_ID" | jq -r '.progress_percent')
  STAGE=$(curl -s "$API_BASE/scan/$JOB_ID" | jq -r '.current_stage')
  
  echo "[$STAGE] $STATUS - $PROGRESS%"
  
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then
    break
  fi
  
  sleep 10
done

# Get results
if [[ "$STATUS" == "completed" ]]; then
  echo "Scan completed! Fetching results..."
  curl -s "$API_BASE/results/$JOB_ID" | jq > "results_$JOB_ID.json"
  echo "Results saved to: results_$JOB_ID.json"
else
  echo "Scan failed!"
fi
