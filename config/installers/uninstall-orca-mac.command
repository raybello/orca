#!/bin/bash
# Double-click launcher for uninstall-orca-mac.sh.
cd "$(dirname "$0")" || exit 1
bash ./uninstall-orca-mac.sh
status=$?
echo
read -n 1 -r -p "Press any key to close this window..."
exit $status
