# Changelog

This file records additions made in this revival of the original Soura website.

## Current version — 2026-10-21

### Added

- Reciter search above the reciter selector. Search is case-insensitive and ignores Arabic diacritics and common alif/hamza variants (`ا`, `أ`, `إ`, `آ`, `ٱ`).
- Automatic reciter selection when the search has one result, or an exact name match. When several results remain, choose one from the selector.
- Playback restoration using `localStorage`: the selected reciter, current surah within the daily list, playback time, and whether playback was active are saved and restored after a refresh on the same date.
- A request counter in the reciter-loading flow so a late response from an older selection cannot replace the latest selection.
- Amiri Arabic font and a simplified footer crediting the original creator and linking to this revival's GitHub repository.
- Arabic and English documentation added.

