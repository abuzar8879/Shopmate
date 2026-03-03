import React from 'react';

const ProfileLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ProfileLayout;
