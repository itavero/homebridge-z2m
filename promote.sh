#!/bin/sh
if [ $# -lt 2 ]
  then
    echo "Script requires at least TWO arguments: version and OTP code"
    exit 1
fi

npm dist-tag add homebridge-z2m@$1 latest --otp ${@:2}