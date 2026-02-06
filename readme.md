# SMU FBS 2.0

This is the front-end and back-end code for **SMU FBS 2.0**, SMU's improved facility booking platform.

---

## Project Structure

FBS_3.0/
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
cd smu-fbs-3

## 2. Install dependencies
Backend
cd backend
npm install

Frontend
cd ../frontend
npm install

3. Launch the servers
Terminal A: Backend
cd backend
node index.js


You should see:

Server running on 3001

Terminal B: Frontend
cd frontend
npm run dev


You should see something like:

VITE v7.3.1 ready in xxx ms
Local: http://localhost:5173/

4. Open the app

Go to your browser and open:

http://localhost:5173