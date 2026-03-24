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
      <button onClick={onClose}>✕</button>
    </div>
  );
}
