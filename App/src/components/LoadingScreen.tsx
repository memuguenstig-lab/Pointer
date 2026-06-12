import React from 'react';
import '../styles/LoadingScreen.css';
import loadingGif from '../assets/loading.gif';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Establishing connection...' }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="animation-container">
          <img src={loadingGif} alt="Loading" className="loading-animation" />
        </div>
        <div className="loading-message">{message}</div>
      </div>
    </div>
  );
};

export default LoadingScreen; 
