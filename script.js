const API_KEY = process.env.API_KEY;
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Authentication state
let isAuthenticated = false;
let userProfile = null;

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const promptInput = document.getElementById('prompt-input');
const thinkToggle = document.getElementById('think-toggle');
const generateBtn = document.getElementById('generate-btn');
const previewFrame = document.getElementById('preview-frame');
const refreshBtn = document.getElementById('refresh-preview');
const fullscreenBtn = document.getElementById('fullscreen-preview');
const previewOverlay = document.querySelector('.preview-overlay');
const statusText = thinkToggle.querySelector('.status-text');
const resizer = document.getElementById('panel-resizer');
const chatSection = document.querySelector('.chat-section');
const chatContent = document.querySelector('.chat-content');
const signOutBtn = document.getElementById('sign-out');

let isThinking = false;
let isGenerating = false;
let currentPreviewContent = '';
let chatHistory = [];
let lastGeneratedTextContent = null;
let isResizing = false;

// Initialize welcome preview
function initializeWelcomePreview() {
    const welcomeHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body {
                    margin: 0;
                    padding: 2rem;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    background: #f8fafc;
                    color: #1e293b;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    text-align: center;
                }
                h1 {
                    font-size: 2.5rem;
                    margin-bottom: 1rem;
                    background: linear-gradient(135deg, #7c3aed, #3b82f6);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                p {
                    font-size: 1.125rem;
                    color: #64748b;
                    max-width: 600px;
                    margin-bottom: 2rem;
                }
                .features {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    width: 100%;
                    max-width: 800px;
                }
                .feature {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease;
                }
                .feature:hover {
                    transform: translateY(-5px);
                }
            </style>
        </head>
        <body>
            <h1>Welcome to PDFGenius AI</h1>
            <p>Describe the PDF document you need, and I'll generate the content for you. You can then download it as a PDF.</p>
            <div class="features">
                <div class="feature">
                    <h3>Smart Content Generation</h3>
                    <p>AI-powered content creation for various PDF document types.</p>
                </div>
                <div class="feature">
                    <h3>Think Mode</h3>
                    <p>Enable deep thinking for more detailed and structured content.</p>
                </div>
                <div class="feature">
                    <h3>Live Preview & Download</h3>
                    <p>See your PDF content generated in real-time and download it as a PDF.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    updatePreview(welcomeHTML);
}

// Update preview with text content
function updatePreview(textContent) {
    try {
        const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        previewDoc.open();
        
        // Create the minimal HTML structure for text/markdown preview
        currentPreviewContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { 
                        font-family: 'Plus Jakarta Sans', sans-serif; 
                        margin: 20px; 
                        white-space: pre-wrap; /* CSS property to preserve whitespace and wrap text */
                        word-wrap: break-word; /* Breaks long words to prevent overflow */
                    }
                </style>
                <title>Content Preview</title>
            </head>
            <body>
                <pre>${textContent}</pre>
            </body>
            </html>
        `;
        
        // Update the preview frame
        previewDoc.write(currentPreviewContent);
        previewDoc.close();
    } catch (error) {
        console.error('Preview update error:', error);
    }
}

// Open preview in new tab
function openPreviewInNewTab() {
    if (currentPreviewContent) {
        const newTab = window.open();
        newTab.document.write(currentPreviewContent);
        newTab.document.close();
    }
}

// Toggle think mode
thinkToggle.addEventListener('click', () => {
    isThinking = !isThinking;
    thinkToggle.classList.toggle('active');
    statusText.textContent = isThinking ? 'ON' : 'OFF';

    // Add status message to chat
    if (isThinking) {
        addChatMessage('ai', 'Thinking Activated... I will consider your request more deeply.', 'status');
    } else {
        addChatMessage('ai', 'Thinking Deactivated... I will generate content more quickly.', 'status');
    }
});

// Show/hide generating overlay
function toggleGeneratingOverlay(show) {
    previewOverlay.classList.toggle('visible', show);
}

// Step handling
function updateStep(stepIndex, status) {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index < stepIndex) {
            step.classList.add('completed');
        } else if (index === stepIndex) {
            step.classList.add('active');
        }
    });
}

// Panel Resizing
function initializeResizer() {
    let startX, startWidth;

    function startResizing(e) {
        isResizing = true;
        startX = e.pageX;
        startWidth = chatSection.offsetWidth;
        resizer.classList.add('resizing');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    }

    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const width = startWidth + (e.pageX - startX);
        
        // Limit the width between min and max values
        if (width >= 400 && width <= window.innerWidth - 400) {
            chatSection.style.width = `${width}px`;
        }
    }

    function stopResizing() {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    }

    resizer.addEventListener('mousedown', startResizing);
}

// Add chat message
function addChatMessage(role, content, type = 'text') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `<i class="fas ${role === 'user' ? 'fa-user' : 'fa-robot'}"></i> ${role === 'user' ? 'You' : 'AI'}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    if (type === 'status') {
        messageContent.innerHTML = `<div class="status-message"><i class="fas fa-spinner fa-spin"></i> ${content}</div>`;
    } else if (type === 'code') { // 'code' type is used for the generated text content, with a PDF download button
        messageContent.innerHTML = `
            <div class="code-message">
                <pre>${content}</pre>
                <button class="download-btn" onclick="downloadPdf(lastGeneratedTextContent)">
                    <i class="fas fa-download"></i> Download PDF
                </button>
            </div>`;
    } else {
        messageContent.textContent = content;
    }
    
    messageDiv.appendChild(header);
    messageDiv.appendChild(messageContent);
    chatContent.appendChild(messageDiv);
    
    // Save to history
    chatHistory.push({ role, content, type });
    
    // Scroll to bottom
    chatContent.scrollTop = chatContent.scrollHeight;
}

// Clear chat
function clearChat() {
    chatContent.innerHTML = '';
    chatHistory = [];
    lastGeneratedTextContent = null;
}

// Download PDF
function downloadPdf(textContent) {
    if (!textContent) {
        alert("No content to download.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Basic text rendering. For more complex markdown, a parser would be needed.
    // jsPDF's text method can handle line breaks.
    // We'll split the text into lines and add them.
    // Define margins and line height
    const margin = 10;
    const lineHeight = 7; // Adjust as needed for your font size
    let y = margin;

    // Split text by lines
    const lines = doc.splitTextToSize(textContent, doc.internal.pageSize.getWidth() - margin * 2);

    lines.forEach(line => {
        if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin; // Reset y for new page
        }
        doc.text(line, margin, y);
        y += lineHeight;
    });

    let filename = 'generated_pdf.pdf';
    const firstLineSanitized = textContent.split('\n')[0].substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (firstLineSanitized) {
        filename = firstLineSanitized + '.pdf';
    }

    doc.save(filename);
}

// Authentication handling
function handleCredentialResponse(response) {
    if (response.credential) {
        // Verify the token with Google
        fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + response.credential)
            .then(res => res.json())
            .then(data => {
                if (data.aud === '423542242333-6tv9nokijgd4oe79eap8gp9oqhop0p9i.apps.googleusercontent.com') {
                    // Token is valid
                    userProfile = {
                        name: data.name,
                        email: data.email,
                        picture: data.picture
                    };
                    isAuthenticated = true;
                    showApp();
                } else {
                    handleGoogleError('Invalid token audience');
                }
            })
            .catch(error => {
                handleGoogleError('Token verification failed');
                console.error('Token verification error:', error);
            });
    }
}

function handleGoogleError(error) {
    console.error('Google Sign-In Error:', error);
    // You might want to show a user-friendly error message here
    alert('Authentication failed. Please try again.');
}

function showApp() {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    initializeWelcomePreview();
    promptInput.focus(); // Set focus to prompt input
}

function signOut() {
    isAuthenticated = false;
    userProfile = null;
    appContainer.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    // Clear any stored tokens or session data
    localStorage.removeItem('google_token');
}

// Initialize sign-out button
document.getElementById('sign-out').addEventListener('click', signOut);

// Check for existing user session
if (localStorage.getItem('isAuthenticated') === 'true') {
    isAuthenticated = true;
    userProfile = JSON.parse(localStorage.getItem('userProfile'));
    appContainer.classList.remove('hidden');
    addChatMessage('ai', `Welcome back ${userProfile.name}!`);
}

// Sanitize input
function sanitizeInput(input) {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#96;')
        .replace(/{/g, '&#123;')
        .replace(/}/g, '&#125;');
}

// Generate PDF content
async function generatePdfContent() {
    if (!isAuthenticated) {
        console.error('User not authenticated');
        return;
    }

    const rawPrompt = promptInput.value.trim();
    if (!rawPrompt || isGenerating) return;

    // Sanitize input
    const prompt = sanitizeInput(rawPrompt);

    isGenerating = true;
    generateBtn.classList.add('loading');
    toggleGeneratingOverlay(true);
    
    // Add user message with sanitized input
    addChatMessage('user', prompt);
    addChatMessage('ai', isThinking ? 'Thinking deeply about your request...' : 'Generating your PDF content...', 'status');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'PDFGenius' // Updated X-Title
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-pro-exp-03-25:free",
                temperature: isThinking ? 0.9 : 0.7,
                messages: [{
                    role: "user",
                    content: `You are an AI assistant that helps users generate content for PDF documents. The user wants a document based on the following description: '${prompt}'. Please generate the content for this PDF. You can use markdown for formatting if appropriate (e.g., headings, lists, bold, italics). Do not include any HTML, CSS, or JavaScript code in your response. Focus on providing well-structured text content suitable for a PDF document.`
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            const generatedContent = data.choices[0].message.content;
            
            // Clean the response - for now, just trim whitespace. Consider removing backticks if model uses them.
            const cleanContent = generatedContent.trim();
            
            // Store the generated content
            lastGeneratedTextContent = cleanContent;
            
            // Add success message and content
            addChatMessage('ai', 'PDF content generated successfully! You can see the preview on the right and download the PDF below.');
            addChatMessage('ai', cleanContent, 'code'); // 'code' type is used for preformatted text display
            
            // Update preview
            updatePreview(cleanContent);
        } else {
            throw new Error('Invalid response format from API');
        }

    } catch (error) {
        console.error('Error:', error);
        addChatMessage('ai', `Error: ${error.message}. Please try again with a different prompt.`);
        updatePreview(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        font-family: 'Plus Jakarta Sans', sans-serif;
                        background: #f8fafc;
                        color: #1e293b;
                        text-align: center;
                        padding: 2rem;
                    }
                    .error-icon {
                        font-size: 3rem;
                        color: #ef4444;
                        margin-bottom: 1rem;
                    }
                    .error-message {
                        color: #64748b;
                        margin-top: 0.5rem;
                    }
                </style>
            </head>
            <body>
                <div class="error-icon">⚠️</div>
                <h2>Generation Error</h2>
                <p class="error-message">${sanitizeInput(error.message)}</p>
                <p>Please try again with a different prompt.</p>
            </body>
            </html>
        `);
    } finally {
        isGenerating = false;
        generateBtn.classList.remove('loading');
        toggleGeneratingOverlay(false);
        promptInput.value = ''; // Clear input after generation
    }
}

// Event listeners
signOutBtn.addEventListener('click', signOut);
generateBtn.addEventListener('click', generatePdfContent);
promptInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        generatePdfContent();
    }
});
refreshBtn.addEventListener('click', () => {
    // Re-render with the last generated text content if available
    if (lastGeneratedTextContent) {
        updatePreview(lastGeneratedTextContent);
    } else {
        // If no content yet, can re-initialize welcome or show a specific message
        initializeWelcomePreview(); 
    }
});
fullscreenBtn.addEventListener('click', openPreviewInNewTab);
document.getElementById('clear-chat').addEventListener('click', clearChat);

// Initialize the app
initializeWelcomePreview();
initializeResizer();

// Add download button next to fullscreen button
const downloadBtn = document.createElement('button');
downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download PDF';
downloadBtn.className = 'download-btn'; // Keep class for styling, or create a new one if needed
downloadBtn.onclick = () => {
    if (lastGeneratedTextContent) {
        downloadPdf(lastGeneratedTextContent);
    } else {
        alert("No content generated yet to download.");
    }
};

// Append the button to the preview controls
const previewControls = document.querySelector('.preview-controls');
previewControls.insertBefore(downloadBtn, fullscreenBtn);