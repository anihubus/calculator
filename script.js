const expressionDisplay = document.getElementById('expressionDisplay');
const resultDisplay = document.getElementById('resultDisplay');
const buttonGrid = document.getElementById('buttonGrid');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');
const copyResultBtn = document.getElementById('copyResult');
const downloadPdfBtn = document.getElementById('downloadPdf');
const themeToggle = document.getElementById('themeToggle');
const resultNote = document.getElementById('resultNote');
const loaderScreen = document.getElementById('loaderScreen');
const liveClock = document.getElementById('liveClock');

let currentExpression = '';
let currentResult = '0';
let historyItems = [];
let memoryValue = 0;
let soundEnabled = true;

function clampDisplay(value) {
  if (value.length > 30) {
    return value.slice(0, 30) + '...';
  }
  return value;
}

function updateScreen() {
  expressionDisplay.textContent = currentExpression || '0';
  resultDisplay.textContent = clampDisplay(String(currentResult));
}

function addHistory(expression, result) {
  historyItems.unshift({ expression, result, timestamp: new Date() });
  if (historyItems.length > 12) historyItems.pop();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  if (!historyItems.length) {
    historyList.innerHTML = '<p class="history-empty">No calculations yet. Tap an equation.</p>';
    return;
  }

  historyItems.forEach(item => {
    const entry = document.createElement('article');
    entry.className = 'history-item';
    entry.innerHTML = `
      <p class="history-expression">${item.expression}</p>
      <p class="history-result">= ${item.result}</p>
    `;
    entry.addEventListener('click', () => {
      currentExpression = item.expression;
      currentResult = item.result;
      updateScreen();
    });
    historyList.appendChild(entry);
  });
}

function showStatus(message, isError = false) {
  resultNote.textContent = message;
  resultNote.style.color = isError ? '#fda4af' : '';
  setTimeout(() => {
    resultNote.style.color = '';
    resultNote.textContent = 'Ready for quantum input.';
  }, 2200);
}

function playClickSound() {
  if (!soundEnabled || !window.AudioContext) return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 450;
    gain.gain.value = 0.09;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.04);
    oscillator.onended = () => context.close();
  } catch (error) {
    console.warn('Sound not supported:', error);
  }
}

function createRipple(event) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = button.getBoundingClientRect();
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  button.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

function factorial(x) {
  const n = Math.floor(x);
  if (n < 0 || n !== x) throw new Error('Factorial only supports non-negative integers');
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function safeEvaluate(raw) {
  let expression = raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/ /g, '');
  expression = expression.replace(/\^/g, '**');

  const functions = {
    sin: 'Math.sin',
    cos: 'Math.cos',
    tan: 'Math.tan',
    sqrt: 'Math.sqrt',
    log: 'Math.log',
  };

  Object.keys(functions).forEach(key => {
    const regex = new RegExp(`${key.replace(/([.*+?^=!:${}()|[\]\\])/g, '\\$1')}\\(`, 'g');
    expression = expression.replace(regex, `${functions[key]}(`);
  });

  expression = expression.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

  while (/([^(^\d]\*\*|\d|\))!/.test(expression) || /\d+!/.test(expression)) {
    const replaced = expression.replace(/(\([^()]*\)|\d+(?:\.\d+)?)!/g, (match, group) => {
      const value = group.startsWith('(')
        ? Function(`return ${group}`)()
        : Number(group);
      return factorial(value);
    });
    if (replaced === expression) break;
    expression = replaced;
  }

  if (!/^[0-9+\-*/().%\sMathsincoatgeqrtlog]*$/.test(expression)) {
    throw new Error('Invalid expression');
  }

  return Function(`"use strict"; return (${expression})`)();
}

function calculateExpression() {
  if (!currentExpression.trim()) {
    showStatus('Enter a valid expression first.', true);
    return;
  }

  try {
    const result = safeEvaluate(currentExpression);
    if (!Number.isFinite(result)) throw new Error('Calculation out of range');
    currentResult = Number.isInteger(result) ? result : Number(result.toFixed(10));
    addHistory(currentExpression, currentResult);
    updateScreen();
    showStatus('Calculation complete.');
  } catch (error) {
    currentResult = 'Error';
    updateScreen();
    showStatus(error.message || 'Invalid expression', true);
  }
}

function appendInput(value) {
  if (currentExpression.length > 48) return;
  if (currentExpression === '0' && /[0-9.]/.test(value)) currentExpression = '';
  currentExpression += value;
  updateScreen();
}

function handleCommand(action) {
  switch (action) {
    case 'clear':
      currentExpression = '';
      currentResult = '0';
      updateScreen();
      showStatus('Cleared.');
      break;
    case 'delete':
      currentExpression = currentExpression.slice(0, -1);
      updateScreen();
      break;
    case 'calculate':
      calculateExpression();
      break;
    case 'memoryPlus':
      memoryValue += Number(currentResult) || 0;
      showStatus('Added to memory.');
      break;
    case 'memoryMinus':
      memoryValue -= Number(currentResult) || 0;
      showStatus('Subtracted from memory.');
      break;
    case 'memoryRecall':
      currentExpression += memoryValue.toString();
      updateScreen();
      showStatus('Memory recalled.');
      break;
    case 'memoryClear':
      memoryValue = 0;
      showStatus('Memory cleared.');
      break;
    default:
      break;
  }
}

buttonGrid.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;

  const value = target.dataset.value;
  const action = target.dataset.action;
  createRipple(event);
  playClickSound();

  if (action) {
    handleCommand(action);
    return;
  }

  if (value) {
    appendInput(value);
  }
});

clearHistoryBtn.addEventListener('click', () => {
  historyItems = [];
  renderHistory();
  showStatus('History cleared.');
});

copyResultBtn.addEventListener('click', async () => {
  if (!currentResult) return;
  try {
    await navigator.clipboard.writeText(String(currentResult));
    showStatus('Result copied.');
  } catch {
    showStatus('Copy failed.', true);
  }
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light-theme');
  const isLight = document.body.classList.contains('light-theme');
  localStorage.setItem('calculatorTheme', isLight ? 'light' : 'dark');
  showStatus(isLight ? 'Light theme enabled.' : 'Dark theme enabled.');
});

window.addEventListener('keydown', event => {
  if (event.repeat) return;
  const keys = {
    Enter: 'calculate',
    '=': 'calculate',
    Backspace: 'delete',
    Escape: 'clear',
  };

  if (keys[event.key]) {
    event.preventDefault();
    handleCommand(keys[event.key]);
    return;
  }

  if (/^[0-9+\-*/().%^]$/.test(event.key)) {
    event.preventDefault();
    appendInput(event.key === '^' ? '^' : event.key);
    return;
  }

  if (event.key.toLowerCase() === 's') appendInput('sin(');
  if (event.key.toLowerCase() === 'c') appendInput('cos(');
  if (event.key.toLowerCase() === 't') appendInput('tan(');
  if (event.key.toLowerCase() === 'l') appendInput('log(');
});

function initializeTheme() {
  const storedTheme = localStorage.getItem('calculatorTheme');
  if (storedTheme === 'light') document.body.classList.add('light-theme');
}

function updateClock() {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

function finishStartup() {
  loaderScreen.classList.add('loaded');
  loaderScreen.style.opacity = '0';
  setTimeout(() => loaderScreen.remove(), 500);
}

function startApp() {
  initializeTheme();
  renderHistory();
  updateScreen();
  updateClock();
  setInterval(updateClock, 1000);
  setTimeout(finishStartup, 950);
}

window.addEventListener('load', startApp);

/**
 * Generate a clean, modern PDF with the current expression, result, and timestamp,
 * then trigger an automatic download using jsPDF.
 */
function downloadPdf() {
  try {
    // prefer calculation timestamp from history, fallback to now
    const ts = (historyItems && historyItems.length) ? new Date(historyItems[0].timestamp) : new Date();
    const dateStr = ts.toLocaleDateString();
    const timeStr = ts.toLocaleTimeString();
    const expr = currentExpression || '';
    const result = currentResult;

    // Access jsPDF from the UMD bundle added to index.html
    const jsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
    if (!jsPDF) {
      showStatus('PDF library not available.', true);
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    let y = 72;

    // Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('Calculator Result', margin, y);

    // Meta (date/time)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    y += 24;
    doc.text(`Date: ${dateStr}`, margin, y);
    doc.text(`Time: ${timeStr}`, margin + 260, y);

    // Expression box
    y += 20;
    doc.setFillColor(245, 246, 250);
    doc.rect(margin, y, doc.internal.pageSize.getWidth() - margin * 2, 44, 'F');
    doc.setTextColor(30);
    doc.setFontSize(12);
    doc.text('Expression:', margin + 6, y + 14);
    doc.setFontSize(11);
    doc.text(String(expr), margin + 100, y + 14, { maxWidth: doc.internal.pageSize.getWidth() - margin * 2 - 110 });

    // Result
    y += 70;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Result:', margin + 6, y);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20);
    doc.text(String(result), margin + 100, y);

    // Footer note
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text('Generated by Smart Hackathon Calculator', margin, doc.internal.pageSize.getHeight() - 40);

    // Auto-download filename with timestamp
    const filename = `calculator-result-${ts.toISOString().slice(0,19).replace(/:/g,'-')}.pdf`;
    doc.save(filename);
    showStatus('PDF downloaded.');
  } catch (err) {
    console.error(err);
    showStatus('Failed to generate PDF.', true);
  }
}

// Wire up the button
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', () => {
    downloadPdf();
  });
}
