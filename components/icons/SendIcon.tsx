
import React from 'react';

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.949a.75.75 0 00.95.826L11.25 9.25v1.5L4.643 12.01a.75.75 0 00-.95.826l-1.414 4.949a.75.75 0 00.95.826L16.25 10l-13.145-7.711z" />
  </svg>
);

export default SendIcon;
