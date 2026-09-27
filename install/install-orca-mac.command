#!/bin/bash
# Double-click launcher for install-orca-mac.sh.
cd "$(dirname "$0")" || exit 1
bash ./install-orca-mac.sh
status=$?
echo
read -n 1 -r -p "Press any key to close this window..."
exit $status
