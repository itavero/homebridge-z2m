#!/bin/sh
if [ $# -lt 1 ]
  then
    echo "Script requires at least ONE argument: OTP code"
    exit 1
fi

npm publish --tag next --otp $@