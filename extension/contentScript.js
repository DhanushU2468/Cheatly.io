// This script runs in the context of the web page
console.log('AI Interview Assistant loaded');

// Create a floating container for responses
const container = document.createElement('div');
container.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  width: 300px;
  background: #1a1a1a;
  color: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  z-index: 9999;
  font-family: Arial, sans-serif;
`;

const title = document.createElement('h3');
title.textContent = 'AI Interview Assistant';
title.style.margin = '0 0 10px 0';

container.appendChild(title);
document.body.appendChild(container); 