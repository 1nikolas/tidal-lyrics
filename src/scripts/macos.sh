#!/bin/bash

output=$((osascript $1) 2>&1)

if [[ $output == *"Not authorised to send Apple events to System Events"* ]]; then
    echo "noEventsPerm"
elif [[ $output == *"osascript is not allowed assistive access"* ]]; then
    echo "noAccessibilityPerm"
elif [[ $output == *"Can’t get process"* ]]; then
    echo "notRunning"
elif [[ $output == *"Can’t get window 1 of process"* ]]; then
    echo "notRunning"
else
    echo $output
fi