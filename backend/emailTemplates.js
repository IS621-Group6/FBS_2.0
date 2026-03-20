// build dynamic email bodies for booking confirmations

function formatBookingConfirmation(role = "student", financial = {}) {
  role = String(role).toLowerCase();
  if (role === "student") {
    return "Your reservation has been confirmed.\nNote: Please review the cancellation policy for changes and cancellations.";
  }
  if (role === "staff") {
    return "Your reservation has been confirmed.\nNote: Please review the cancellation policy for changes and cancellations.";
  }
  return "Your reservation has been confirmed.";
}

module.exports = { formatBookingConfirmation };
