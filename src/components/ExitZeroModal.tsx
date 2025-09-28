/**
 * ExitZero Modal Component - <10kB gzipped
 * Lightweight Preact-based retention modal
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ExitZeroModalProps {
  offer: {
    id: string;
    type: string;
    value: number;
    description: string;
    copy: {
      headline: string;
      body: string;
      cta: string;
    };
    expiresAt: string;
  };
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onClose: () => void;
  apiUrl: string;
}

export function ExitZeroModal({ 
  offer, 
  onAccept, 
  onDecline, 
  onClose, 
  apiUrl 
}: ExitZeroModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await fetch(`${apiUrl}/api/cancel-intent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer.id,
          response: 'accepted',
          userId: 'current_user' // This would be passed from parent
        })
      });
      onAccept(offer.id);
    } catch (error) {
      console.error('Failed to accept offer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await fetch(`${apiUrl}/api/cancel-intent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer.id,
          response: 'declined',
          userId: 'current_user'
        })
      });
      onDecline(offer.id);
    } catch (error) {
      console.error('Failed to decline offer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all duration-300 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {offer.copy.headline}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-600 mb-4">
            {offer.copy.body}
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-700">
                {offer.description}
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-4">
            Offer expires: {new Date(offer.expiresAt).toLocaleString()}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
          <div className="flex space-x-3">
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                offer.copy.cta
              )}
            </button>
            
            <button
              onClick={handleDecline}
              disabled={isLoading}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              No Thanks
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Lightweight script loader for the modal
export function loadExitZeroScript(apiUrl: string, customerId: string) {
  // Check if already loaded
  if (window.exitZeroLoaded) return;
  
  // Create script element
  const script = document.createElement('script');
  script.src = `${apiUrl}/api/exit-zero-script.js`;
  script.async = true;
  script.onload = () => {
    // Initialize the modal system
    if (window.ExitZero) {
      window.ExitZero.init({
        apiUrl,
        customerId,
        theme: 'light' // or 'dark'
      });
    }
  };
  
  document.head.appendChild(script);
  window.exitZeroLoaded = true;
}

// Global types for the script
declare global {
  interface Window {
    exitZeroLoaded?: boolean;
    ExitZero?: {
      init: (config: { apiUrl: string; customerId: string; theme: string }) => void;
      showModal: (offer: any) => void;
      hideModal: () => void;
    };
  }
}
