function insertAuditLog(db, action, userEmail, bookingId, details) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (action, user_email, booking_id, details) VALUES (?, ?, ?, ?)`
    ).run(action, userEmail, bookingId, JSON.stringify(details));
  } catch (error) {
    if (String(error?.message || "").includes("no such table: audit_logs")) {
      return;
    }

    throw error;
  }
}

function selectAuditLogs(db, whereSql, params) {
  try {
    return db.prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY timestamp DESC`).all(...params);
  } catch (error) {
    if (String(error?.message || "").includes("no such table: audit_logs")) {
      return [];
    }

    throw error;
  }
}

module.exports = {
  insertAuditLog,
  selectAuditLogs,
};