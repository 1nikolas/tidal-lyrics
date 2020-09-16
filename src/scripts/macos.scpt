#!/usr/bin/env osascript
global frontApp, windowTitle
set windowTitle to ""
tell application "System Events"
	tell process "TIDAL"
		tell (1st window whose value of attribute "AXTitle" is not null)
			set windowTitle to value of attribute "AXTitle"
		end tell
	end tell
end tell
return windowTitle