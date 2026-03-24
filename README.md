# SMU FBS 2.0

This is the front-end and back-end code for **SMU FBS 2.0**, SMU's improved facility booking platform.

---

## Project Structure

FBS_2.0/
├─ frontend/ # React + Vite frontend
├─ backend/ # Node.js + Express backend
├─ .gitignore
└─ README.md

---

## Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/)
- A code editor like [VS Code](https://code.visualstudio.com/)

---

## 1. Clone the repository

```bash
git clone https://github.com/Cherrilynss/FBS_2.0.git
cd FBS_2.0
```

## 2. Install dependencies

**Backend**
```bash
cd backend
npm install
```

**Frontend**
```bash
cd ../frontend
npm install
```

## 3. Launch the servers

**Terminal A: Backend**
```bash
cd backend
npm run init-db
npm run start
```

`npm run init-db` recreates `database/fbs.sqlite` and seeds the full SMU facility catalog plus equipment.

You should see:
```
Backend running on port 3001
```

**Terminal B: Frontend**
```bash
cd frontend
npm run dev
```

You should see something like:
```
VITE v7.3.1 ready in xxx ms
Local: http://localhost:5173/
```

## 4. Open the app

Go to your browser and open:

```
http://localhost:5173
```

---

## Deployment

### Frontend — Vercel

1. Import the repository in [Vercel](https://vercel.com/).
2. **Important:** In the Vercel project settings, set the **Root Directory** to `frontend/`.
   Vercel only reads `vercel.json` from its configured root, so the rewrites in `frontend/vercel.json` only take effect when this is set correctly.
3. Set the **Build Command** to `npm run build` and **Output Directory** to `dist` (Vercel auto-detects these for Vite, but confirm they are correct).
4. After deploying the backend (see below), update the rewrite destination in `frontend/vercel.json` to point to your Render service URL.

### Backend — Render

1. Create a new **Web Service** in [Render](https://render.com/) pointing to this repository.
2. Set the **Root Directory** to `backend/`.
3. Set the **Build Command** to `npm install` and the **Start Command** to `npm start`.
4. Add any required environment variables (e.g. `PORT`, `JWT_SECRET`).
5. Copy the Render service URL and update `frontend/vercel.json` with it, then redeploy the Vercel frontend.