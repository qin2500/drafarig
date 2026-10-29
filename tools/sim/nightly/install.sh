#!/bin/zsh
# Install (or remove) the overnight trainer as a launchd job for this user: it starts nightly.mjs every night at 00:30
# (launchd runs a missed start when the Mac wakes). nightly.mjs itself waits for AC power and an idle laptop, and exits at
# the end of its window.
#   zsh tools/sim/nightly/install.sh            install / update
#   zsh tools/sim/nightly/install.sh uninstall  remove
#   node tools/sim/nightly/nightly.mjs --status progress and the log tail
set -e
LABEL=com.drafarig.nightly
PLIST=$HOME/Library/LaunchAgents/$LABEL.plist
REPO=${0:A:h:h:h:h}
NODE=${NODE:-$(command -v node || echo $HOME/.local/bin/node)}
launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true
if [[ $1 == uninstall ]]; then rm -f $PLIST; echo "removed $LABEL"; exit 0; fi
mkdir -p $REPO/tools/sim/results/nightly $HOME/Library/LaunchAgents
cat > $PLIST <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$REPO/tools/sim/nightly/nightly.mjs</string></array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>30</integer></dict>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>$REPO/tools/sim/results/nightly/launchd.log</string>
  <key>StandardErrorPath</key><string>$REPO/tools/sim/results/nightly/launchd.log</string>
</dict>
</plist>
EOF
launchctl bootstrap gui/$(id -u) $PLIST
echo "installed $LABEL: nightly at 00:30 ($NODE, $REPO)"
