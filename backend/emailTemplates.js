// build dynamic email bodies for booking confirmations

function formatBookingConfirmation(role = "student", financial = {}) {
  role = String(role).toLowerCase();
  if (role === "student") {
    const { deducted = 0, creditsRemaining = 0 } = financial;
    return `Your reservation has been confirmed.\nCredits deducted: ${deducted}. Remaining balance: ${creditsRemaining} of 4500.\nNote: Cancellations made < 24 hours before start time will yield a 50% credit refund.`;
  }
  if (role === "staff") {
    const { costCentre = "unknown" } = financial;
    return `Your reservation has been confirmed.\nCost centre billed: ${costCentre}.\nStaff cancellation penalties are tier-based; please review your policy.`;
  }
  return "Your reservation has been confirmed.";
}

module.exports = { formatBookingConfirmation };
