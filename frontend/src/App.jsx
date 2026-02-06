import { useEffect, useState } from "react";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");

  useEffect(() => {
    fetch("http://localhost:3001")
      .then((res) => res.text())
      .then((data) => setBackendStatus(data))
      .catch(() => setBackendStatus("❌ Backend not connected"));
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>SMU FBS 3.0</h1>

      <div style={styles.card}>
        <h2>System Status</h2>
        <p>{backendStatus}</p>
      </div>

      <div style={styles.card}>
        <h2>What would you like to do?</h2>
        <ul>
          <li>Create / edit profile</li>
          <li>Browse activities</li>
          <li>Find matches</li>
          <li>Admin dashboard</li>
        </ul>
      </div>

      <p style={styles.footer}>
        If you see this page, you are editing the correct file 👍
      </p>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    padding: "40px",
    backgroundColor: "#f5f7fa",
    minHeight: "100vh",
  },
  title: {
    marginBottom: "20px",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "20px",
    marginBottom: "20px",
    borderRadius: "8px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
  footer: {
    marginTop: "40px",
    color: "#666",
    fontSize: "14px",
  },
};

export default App;
