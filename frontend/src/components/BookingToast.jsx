import React from 'react';
import './BookingToast.css';

// simple toast that disappears after a few seconds
export default function BookingToast({ userRole, creditsInfo, costCentre, onClose }) {
  const isStudent = userRole === 'student';
  return (
    <div className="booking-toast">
      <strong>Success!</strong>
      {isStudent ? (
        <p>
          Credits deducted: <strong>{creditsInfo?.deducted}</strong>, remaining{' '}
          <strong>{creditsInfo?.creditsRemaining}</strong> / 4500.
        </p>
      ) : (
        <p>Cost centre billed: <strong>{costCentre}</strong></p>
      )}
      <p className="policy">
        {isStudent
          ? 'Note: Cancellations made < 24 hours before start time will yield a 50% credit refund.'
          : 'Staff cancellation penalties are tier-based; please review your policy.'}
      </p>
      <button onClick={onClose}>✕</button>
    </div>
  );
}
