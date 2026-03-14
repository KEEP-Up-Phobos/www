import React from 'react';
import './SkeletonCard.css';
import './SkeletonCard.css';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton-image"></div>
      <div className="skeleton-content">
        <div className="skeleton-title"></div>
        <div className="skeleton-text"></div>
        <div className="skeleton-text short"></div>
        <div className="skeleton-text short"></div>
        <div className="skeleton-button"></div>
      </div>
    </div>
  );
};