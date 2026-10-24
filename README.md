# LeetCode + YouTube Docked Sidebar

A Chrome extension that docks a real, signed-in YouTube window to the edge
of your screen (1/3 or 1/4 width) so you can watch DSA tutorials while
solving LeetCode. Your original window auto-shrinks to fill the rest of
the screen, and both windows tile without overlapping.

## Why a real window instead of an embedded panel?
YouTube blocks itself from being embedded in an `<iframe>` by other sites,
so a true in-page sidebar isn't possible. This extension opens a second,
real Chrome window instead — same cookies, same sign-in, full
functionality, no workarounds needed.

## Features
- Docks a real YouTube window to the right edge — 1/3 or 1/4 screen width
- Auto-shrinks and snaps your current window into the remaining space
- Restores your window to its original size/position when you close it
- Optional auto-open when you land on a LeetCode problem page
- Keyboard shortcut: `Ctrl+Shift+Y` (`Cmd+Shift+Y` on Mac)
- No accounts, no ads, no data collection — everything runs locally

## Install
1. Clone or download this repo
2. Go to `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select this folder

## Usage
Click the toolbar icon (or press the shortcut) to open/close the sidebar.
Use the popup to switch between 1/3 and 1/4 width, or turn on auto-open
for LeetCode problem pages.

## Permissions

| Permission | Why |
|---|---|
| `system.display` | Calculate the docked window's size and position |
| `storage` | Save your width/auto-open preferences locally |
| `host_permissions: leetcode.com` | Detect LeetCode problem pages for auto-open |

## ☕ Support

If you enjoy **LeetCode + YouTube Docked Sidebar** and want to support my free extensions:

<a href="https://buymeacoffee.com/ashwiinn" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50">
</a>


