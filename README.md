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