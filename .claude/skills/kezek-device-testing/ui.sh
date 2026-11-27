#!/bin/bash
# Android emulator helper for Kezek UI checks.
# usage: ui.sh dump | ui.sh tap "visible text" | ui.sh shot <name> | ui.sh scroll [toY] | ui.sh back
# Screenshots go to $KEZEK_SHOTS (default: a kezek-shots folder in the system temp dir).
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe}"
S="${KEZEK_SHOTS:-${TEMP:-/tmp}/kezek-shots}"
mkdir -p "$S"
case "$1" in
 dump) "$ADB" exec-out uiautomator dump /dev/tty 2>/dev/null > "$S/cur.xml"; node -e '
  const x=require("fs").readFileSync(process.argv[1],"utf8");
  const re=/<node [^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;let m;
  while((m=re.exec(x))){const t=m[1]||m[2]; if(t.trim()) console.log(`${t} @${(+m[3]+ +m[5])>>1},${(+m[4]+ +m[6])>>1}`)}' "$S/cur.xml";;
 tap) "$ADB" exec-out uiautomator dump /dev/tty 2>/dev/null > "$S/cur.xml"; P=$(node -e '
  const x=require("fs").readFileSync(process.argv[1],"utf8");const want=process.argv[2];
  const re=/<node [^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;let m;
  while((m=re.exec(x))){const t=m[1]||m[2]; if(t.includes(want)){console.log(`${(+m[3]+ +m[5])>>1} ${(+m[4]+ +m[6])>>1}`);break}}' "$S/cur.xml" "$2"); if [ -z "$P" ]; then echo "NOT FOUND: $2"; exit 1; fi; "$ADB" shell input tap $P; echo "tapped $2 at $P";;
 shot) "$ADB" exec-out screencap -p > "$S/$2.png"; echo "$S/$2.png";;
 scroll) "$ADB" shell input swipe 540 1700 540 ${2:-700} 400;;
 back) "$ADB" shell input keyevent KEYCODE_BACK;;
 *) echo "usage: ui.sh dump|tap TEXT|shot NAME|scroll [Y]|back"; exit 2;;
esac
