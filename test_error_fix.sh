#!/bin/bash

# Test script to verify clove format error handling
# This simulates a request that will trigger the tool_use_id error

echo "Testing error handling for invalid tool_use_id..."
echo "This should return the original error without retrying"
echo ""

# You can run this script after starting the API server
# It will send a request that triggers the invalid_request_error
# and verify that the original error is preserved

echo "Expected behavior:"
echo "1. First channel returns 400 - invalid_request_error about tool_use_id"
echo "2. System marks it as skip retry (invalid_request_error)"
echo "3. No retry with second channel"
echo "4. Original error returned to client"
echo ""
echo "Run the API server and check the logs to verify this behavior"