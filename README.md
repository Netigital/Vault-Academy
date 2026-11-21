# Vault Academy

Vault Academy is an offline-first learning app based on Next.js, Express, SQLite, and Socket.IO. It includes a searchable library of local learning materials, timed CBT exams, and a real-time Math Arena.

## Deploy online with Render

GitHub Pages can only serve static files, so it cannot run this app's Next.js server or Express/SQLite backend. To deploy the full app, create a Blueprint in Render from this repository and use `render.yaml`. The Blueprint creates the frontend and API services; set private values for `VAULT_ACADEMY_ADMIN_PASSCODE` and `VAULT_ACADEMY_TEACHER_INVITE` on the API service in Render.

The backend uses a 1 GB persistent disk for its SQLite database and uploaded learning materials. Render requires a paid web-service plan for persistent disks. The frontend is served at `https://vault-academy-web.onrender.com`; the GitHub Pages root `index.html` redirects there. If Render assigns a different service URL, update that redirect and redeploy GitHub Pages.

## Run on Windows

1. Install Node.js LTS (which includes npm).
2. Double-click `start.bat`. On first launch it installs the frontend and backend dependencies, starts both services, and opens the app.
3. Create a student or teacher account from the welcome screen.

This laptop serves the app at `http://localhost:5050`; its API runs at `http://localhost:3001`. Keep it powered on and leave both service windows open while others use the app. Devices must be connected to the same Wi-Fi; the launcher and dashboard show this laptop's LAN address.

The Windows Firewall rule should allow only TCP ports 5050 and 3001, on the Private profile, from the local subnet. To create it, open PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Vault Academy LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5050,3001 -RemoteAddress LocalSubnet -Profile Private
```

For an existing rule that still allows `Any` remote address, narrow it with:

```powershell
Get-NetFirewallRule -DisplayName "Vault Academy LAN" | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -RemoteAddress LocalSubnet
```

The launcher also reinstates the exact Private/LocalSubnet scope on existing runs and blocks ports 5050/3001 on Public and Domain profiles.

Do not forward these ports from your router to the internet. Use Vault Academy only on a trusted private network. Account passwords use salted scrypt hashes; teacher accounts require the private invite code, privileged actions and Math Arena controls require a valid teacher session, and sessions expire after 12 hours.

An unfinished CBT exam is saved in the student's browser for that account. Signing back into the same browser resumes the saved answers and question; the original timer deadline keeps running while signed out. Clearing browser data or switching browsers/devices will not carry that local draft over.

Place learning materials you own or are authorized to distribute in `backend/resources_folder`; the backend indexes local files automatically. Learning PDFs and that folder are intentionally excluded from this GitHub source repository to preserve publisher attribution and avoid distributing unlicensed materials. The local SQLite database includes starter exams and Math Arena questions; new accounts and exam submissions are stored in this copy of the app.

Library PDFs are shown with their source text and attribution intact. Documents that describe the earlier Caesium Vault project are not silently edited or relabeled as Vault Academy materials.

Account passwords are stored as salted scrypt hashes. Existing plaintext account passwords are upgraded to hashes after a successful login. The submission erasure action is disabled unless `VAULT_ACADEMY_ADMIN_PASSCODE` is set. Teacher account creation and teacher controls require the private invite/code configuration and server-side sessions. Create `backend/.env` with two different long private values before starting the backend:

```text
VAULT_ACADEMY_ADMIN_PASSCODE=replace-with-a-long-random-private-value
VAULT_ACADEMY_TEACHER_INVITE=replace-with-a-different-private-teacher-code
```

## Manual start

In separate terminals, run `npm install` and then `npm start` in `backend`, and run `npm install` and then `npm run dev` in `frontend`.
