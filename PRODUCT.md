# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Secondary-school students use Vault Academy to access study resources, complete timed exams, and join live mathematics competitions. Teachers use it to manage learning resources, exams, and Arena sessions.

## Product Purpose

Vault Academy provides a local, offline-first learning environment that lets a school use a laptop and private Wi-Fi network to serve its learning library, CBT exams, and real-time Math Arena.

## Positioning

The app combines locally hosted resources and assessments with a live classroom competition, without requiring students' devices to have internet access.

## Operating Context

The app runs on a Windows laptop on a trusted school or home Wi-Fi network. Students connect through the host's LAN address; teachers use protected controls. The app uses a Next.js frontend and Express, SQLite, and Socket.IO backend.

## Capabilities and Constraints

- Preserve the offline library, CBT exams, resumeable exam progress, live Math Arena, and teacher/admin tools.
- The frontend uses port 5050 and the backend uses port 3001.
- Keep LAN access scoped to the Windows Private profile and local subnet; do not expose the app to the public internet.
- No Kiwix integration.
- Rebrand Vault Academy's own interface and Academy-authored materials. Preserve attribution and original identity in publisher or third-party PDF resources.
- The user selected a whole-app visual redesign, not a feature rewrite.

## Brand Commitments

Use the name Vault Academy. Retain the explicitly requested blue brand palette while replacing the inherited Caesium Vault visual identity. The interface should feel distinct from the original application.

## Evidence on Hand

- Existing offline library, timed CBT flow, and real-time Math Arena in the Vault Academy application.
- Existing local PDFs and starter database content; some PDFs discuss or identify the original Caesium Vault project and must retain their attribution unless confirmed as Academy-authored.
- No verified external customer, performance, or compliance claims.

## Product Principles

- Learning resources and assessments should remain usable over a local network without internet access.
- Students need clear, dependable exam timing and progress recovery.
- Teachers need straightforward controls for lessons, resources, and assessments.
- Security and privacy controls should be understandable and scoped to the local deployment.
