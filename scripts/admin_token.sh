#!/bin/bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)/api/v1
R=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@eibil.in","password":"Admin@12345"}')
OID=$(echo $R | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['otpId'])")
OTP=$(echo $R | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['devOtp'])")
curl -s -X POST $API/auth/2fa/verify -H "Content-Type: application/json" -d "{\"email\":\"admin@eibil.in\",\"code\":\"$OTP\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])"
