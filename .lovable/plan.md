# Responsive Full-App Design

## Goal
Make every Vision Companion screen work comfortably as both a mobile app and a desktop website, while preserving the current white visual style, logo, accessibility, voice controls, and all existing features.

## Changes
- Introduce a shared responsive page width and spacing system for consistent phone, tablet, and desktop layouts.
- Expand Home into a desktop-friendly two-column experience with a wider mode grid, while retaining the compact single-column mobile flow.
- Adapt History, Help, Settings, People, and Emergency pages to use available desktop space without stretching content excessively.
- Give Camera and Navigation focused desktop workspaces: the live camera/map remains prominent, with controls and results arranged beside or below it based on screen width.
- Convert the floating mobile bottom navigation into a clear desktop navigation bar on larger screens.
- Make the voice assistant panel and buttons fit narrow phones safely and sit unobtrusively on desktop.
- Fix headers, language controls, cards, dialogs, and action rows so text never clips or overlaps in English, Telugu, or Hindi.

## Technical Details
- Use Tailwind responsive breakpoints and semantic design tokens only.
- Keep touch targets at least 44px on mobile and add constrained desktop widths/grids.
- Preserve all routes, camera behavior, AI calls, speech, navigation, authentication, and mode lifecycle logic.
- Validate key screens at mobile and desktop viewport sizes, including visual overflow and runtime errors.
