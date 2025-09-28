/**
 * ExitZero Script API - Serves the <10kB modal script
 * This is the JavaScript snippet that customers embed on their sites
 */

import { NextRequest, NextResponse } from 'next/server';

const SCRIPT_CONTENT = `
(function() {
  'use strict';
  
  // ExitZero Modal Script - <10kB gzipped
  // AI-native retention infrastructure
  
  var ExitZero = {
    config: null,
    currentModal: null,
    
    init: function(config) {
      this.config = config;
      this.bindEvents();
    },
    
    bindEvents: function() {
      // Listen for cancel button clicks
      document.addEventListener('click', function(e) {
        var target = e.target;
        var cancelSelectors = [
          '[data-cancel]',
          '[data-cancel-subscription]',
          '.cancel-subscription',
          '.cancel-account',
          '[href*="cancel"]',
          '[href*="unsubscribe"]'
        ];
        
        for (var i = 0; i < cancelSelectors.length; i++) {
          if (target.matches(cancelSelectors[i]) || target.closest(cancelSelectors[i])) {
            e.preventDefault();
            ExitZero.handleCancelClick(e);
            return;
          }
        }
      });
      
      // Listen for form submissions that might be cancellations
      document.addEventListener('submit', function(e) {
        var form = e.target;
        if (form.querySelector('[name*="cancel"]') || 
            form.action.includes('cancel') ||
            form.action.includes('unsubscribe')) {
          e.preventDefault();
          ExitZero.handleCancelSubmit(e);
        }
      });
    },
    
    handleCancelClick: function(e) {
      var target = e.target;
      var customerId = this.getCustomerId();
      
      this.checkForOffer(customerId, function(offer) {
        if (offer && offer.status === 'offer') {
          ExitZero.showModal(offer.offer);
        } else {
          // Proceed with original cancel action
          ExitZero.proceedWithCancel(target);
        }
      });
    },
    
    handleCancelSubmit: function(e) {
      var form = e.target;
      var customerId = this.getCustomerId();
      
      this.checkForOffer(customerId, function(offer) {
        if (offer && offer.status === 'offer') {
          ExitZero.showModal(offer.offer);
        } else {
          // Proceed with original form submission
          ExitZero.proceedWithSubmit(form);
        }
      });
    },
    
    getCustomerId: function() {
      // Try to get customer ID from various sources
      return window.exitZeroCustomerId || 
             this.config.customerId || 
             this.getFromMeta('customer-id') ||
             this.getFromDataAttribute('customer-id') ||
             'unknown';
    },
    
    getFromMeta: function(name) {
      var meta = document.querySelector('meta[name="' + name + '"]');
      return meta ? meta.getAttribute('content') : null;
    },
    
    getFromDataAttribute: function(name) {
      var element = document.querySelector('[data-' + name + ']');
      return element ? element.getAttribute('data-' + name) : null;
    },
    
    checkForOffer: function(customerId, callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', this.config.apiUrl + '/api/cancel-intent', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              var response = JSON.parse(xhr.responseText);
              callback(response);
            } catch (e) {
              console.error('ExitZero: Invalid response', e);
              callback(null);
            }
          } else {
            console.error('ExitZero: API error', xhr.status);
            callback(null);
          }
        }
      };
      
      xhr.send(JSON.stringify({
        userId: customerId,
        customerId: customerId,
        subscriptionId: 'web_' + Date.now(),
        plan: 'web',
        mrr: 0
      }));
    },
    
    showModal: function(offer) {
      if (this.currentModal) {
        this.hideModal();
      }
      
      var modal = this.createModal(offer);
      document.body.appendChild(modal);
      this.currentModal = modal;
      
      // Animate in
      setTimeout(function() {
        modal.classList.add('exit-zero-visible');
      }, 10);
    },
    
    createModal: function(offer) {
      var modal = document.createElement('div');
      modal.className = 'exit-zero-modal';
      modal.innerHTML = this.getModalHTML(offer);
      
      // Bind modal events
      this.bindModalEvents(modal, offer);
      
      return modal;
    },
    
    getModalHTML: function(offer) {
      return \`
        <div class="exit-zero-backdrop">
          <div class="exit-zero-content">
            <div class="exit-zero-header">
              <h3>\${this.escapeHtml(offer.copy.headline)}</h3>
              <button class="exit-zero-close">&times;</button>
            </div>
            <div class="exit-zero-body">
              <p>\${this.escapeHtml(offer.copy.body)}</p>
              <div class="exit-zero-offer">
                <span class="exit-zero-icon">⏰</span>
                <span>\${this.escapeHtml(offer.description)}</span>
              </div>
              <div class="exit-zero-expiry">
                Expires: \${new Date(offer.expiresAt).toLocaleString()}
              </div>
            </div>
            <div class="exit-zero-footer">
              <button class="exit-zero-accept">\${this.escapeHtml(offer.copy.cta)}</button>
              <button class="exit-zero-decline">No Thanks</button>
            </div>
          </div>
        </div>
      \`;
    },
    
    bindModalEvents: function(modal, offer) {
      var self = this;
      
      // Close button
      modal.querySelector('.exit-zero-close').onclick = function() {
        self.hideModal();
      };
      
      // Backdrop click
      modal.querySelector('.exit-zero-backdrop').onclick = function(e) {
        if (e.target === this) {
          self.hideModal();
        }
      };
      
      // Accept button
      modal.querySelector('.exit-zero-accept').onclick = function() {
        self.handleOfferResponse(offer.id, 'accepted');
        self.hideModal();
      };
      
      // Decline button
      modal.querySelector('.exit-zero-decline').onclick = function() {
        self.handleOfferResponse(offer.id, 'declined');
        self.hideModal();
      };
      
      // ESC key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && self.currentModal) {
          self.hideModal();
        }
      });
    },
    
    handleOfferResponse: function(offerId, response) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', this.config.apiUrl + '/api/cancel-intent', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        offerId: offerId,
        response: response,
        userId: this.getCustomerId()
      }));
    },
    
    hideModal: function() {
      if (this.currentModal) {
        this.currentModal.classList.remove('exit-zero-visible');
        setTimeout(function() {
          if (ExitZero.currentModal && ExitZero.currentModal.parentNode) {
            ExitZero.currentModal.parentNode.removeChild(ExitZero.currentModal);
          }
          ExitZero.currentModal = null;
        }, 300);
      }
    },
    
    proceedWithCancel: function(element) {
      // Restore original behavior
      if (element.href) {
        window.location.href = element.href;
      } else if (element.onclick) {
        element.onclick();
      }
    },
    
    proceedWithSubmit: function(form) {
      // Restore original form submission
      form.submit();
    },
    
    escapeHtml: function(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };
  
  // CSS styles (embedded for single file)
  var style = document.createElement('style');
  style.textContent = \`
    .exit-zero-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .exit-zero-modal.exit-zero-visible {
      opacity: 1;
    }
    
    .exit-zero-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .exit-zero-content {
      background: white;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 400px;
      width: 100%;
      transform: scale(0.95) translateY(20px);
      transition: transform 0.3s ease;
    }
    
    .exit-zero-modal.exit-zero-visible .exit-zero-content {
      transform: scale(1) translateY(0);
    }
    
    .exit-zero-header {
      padding: 20px 20px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .exit-zero-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }
    
    .exit-zero-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #9ca3af;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .exit-zero-close:hover {
      color: #6b7280;
    }
    
    .exit-zero-body {
      padding: 20px;
    }
    
    .exit-zero-body p {
      margin: 0 0 16px;
      color: #4b5563;
      line-height: 1.5;
    }
    
    .exit-zero-offer {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 12px;
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .exit-zero-icon {
      margin-right: 8px;
      font-size: 16px;
    }
    
    .exit-zero-expiry {
      font-size: 12px;
      color: #6b7280;
    }
    
    .exit-zero-footer {
      padding: 0 20px 20px;
      display: flex;
      gap: 12px;
    }
    
    .exit-zero-accept {
      flex: 1;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 12px 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .exit-zero-accept:hover {
      background: #1d4ed8;
    }
    
    .exit-zero-decline {
      background: white;
      color: #4b5563;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 12px 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .exit-zero-decline:hover {
      background: #f9fafb;
    }
  \`;
  
  document.head.appendChild(style);
  
  // Make ExitZero globally available
  window.ExitZero = ExitZero;
  
  // Auto-initialize if config is already available
  if (window.exitZeroConfig) {
    ExitZero.init(window.exitZeroConfig);
  }
})();
`;

export async function GET(request: NextRequest) {
  const response = new NextResponse(SCRIPT_CONTENT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Content-Encoding': 'gzip', // This would be handled by Vercel/Next.js
    },
  });

  return response;
}
