# LIVO — Product Requirements Document

## Original Problem Statement
Build a clean, modern web app called LIVO — a voice-first transaction assistance app helping visually impaired users independently complete and verify everyday transactions. Step 1: ONLY frontend structure and navigation. No AI, OCR, camera, cash recognition, voice processing, APIs, or backend logic yet.

## User Personas
- Visually impaired user needing to independently verify bills, identify cash, and confirm change.

## Architecture
- Frontend-only (React + react-router-dom). No backend/DB used in this step.
- Layout with fixed accessible Header (logo + Voice button) and fixed BottomNav (Bill/Cash/Change).
- Pages: Home, BillChecker, CashAssistant, ChangeChecker.
- Design: High-contrast neo-brutalist (Black/White/Yellow #FFD600), Outfit + Atkinson Hyperlegible fonts, large touch targets, focus rings, data-testids.

## Core Requirements (static)
- 4 screens with clear navigation, accessibility-first UI, responsive desktop/mobile.
- Placeholder result areas for future AI features.

## Implemented (2026-06)
- Home: logo, tagline "See. Verify. Pay. Independently.", 3 large module buttons.
- Bill Checker: capture area, Take Photo / Upload Bill buttons, empty result area.
- Cash Assistant: scan area, Scan Cash button, detected notes + total placeholders.
- Change Checker: expected vs received comparison placeholders, Scan Received Change button, result placeholder.
- Fixed header with visual (non-functional) Voice/Mic button; persistent bottom nav.
- Verified rendering & navigation via screenshots.

## Backlog
- P1: Bill OCR + AI reading (integration).
- P1: Cash recognition (camera/AI).
- P1: Change comparison logic.
- P1: Voice assistance (STT/TTS) wiring to the Mic button.
- P2: Camera capture flow and image upload/storage.

## Next Tasks
- Await user direction on which module's functionality to build first.
