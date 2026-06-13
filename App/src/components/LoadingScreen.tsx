import React from 'react';
import '../styles/LoadingScreen.css';
import logo from '../assets/logo.png';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Establishing connection...' }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="animation-container">
          <img src={logo} alt="Loading" className="loading-animation" />
        </div>
        <div className="loading-spinner"></div>
        <div className="loading-message">{message}</div>
      </div>
    </div>
  );
};

export default LoadingScreen; 
