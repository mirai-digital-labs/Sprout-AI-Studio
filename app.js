/* ============================================================
   Sprout AI Studio — v8
   Features: 3 Options, Tones, Canvas Text Overlay
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const TEMPLATES = {
  lead_gen: { label: 'Lead Generation', instruction: `GOAL: LEAD GENERATION. End with a strong CTA.` },
  awareness: { label: 'Brand Awareness', instruction: `GOAL: AWARENESS. Focus on brand personality.` },
  engagement: { label: 'Engagement', instruction: `GOAL: ENGAGEMENT. End with an open question.` },
  launch: { label: 'Launch', instruction: `GOAL: LAUNCH. Highlight benefits and urgency.` },
  educational: { label: 'Educational', instruction: `GOAL: EDUCATIONAL. Provide tips/framework.` },
  event: { label: 'Event', instruction: `GOAL: EVENT. Include WHAT, WHEN, WHERE.` },
  sale: { label: 'Sale', instruction: `GOAL: SALE. Announce offer and deadline.` }
};

// Updated to generate 3 options separated by a specific string
const SYSTEM_POST = `You are a professional Facebook content writer. Transform brand context into 3 COMPLETELY DIFFERENT, publish-ready Facebook posts.
Write like a real human. Tone: {TONE}.
IMPORTANT: Write strictly in Roman Urdu (Urdu in English alphabet).
Output EXACTLY 3 options, separated by the string "===OPTION===".
Do not number them. Just the text separated by the string.
NO markdown, NO quotes around the text.`;

const SYSTEM_IMAGE_PROMPT = `You are an expert AI art director. Generate a highly detailed ENGLISH prompt for an image background based on this post and brand.
The style must be: {STYLE}.
Describe the scene, lighting, and environment in detail.
CRITICAL: NO text, NO letters, NO typography in the image. Output ONLY the English prompt.`;

const state = {
  brandName: '', brandUrl: '', goal: '', tone: '', contentType: 'image', imageStyle: 'photorealistic',
  brandContext: '', postOptions: ['', '', ''], selectedOptionIndex: 0, post: '',
  imagePrompt: '', imageBlob: null, imageUrl: null, imageObj: null,
  settings: { geminiKey: '', textModel: 'gemini-2.0-flash' }
};

async function geminiText(systemPrompt, userMessage, apiKey, model) {
  let m = model || state.settings.textModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const body = { contents: [{ role: 'user', parts: [{ text: userMessage }] }] };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('API Error: ' + (await res.text()).slice(0, 100));
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
}

async function generateFreeImage(prompt) {
  const seed = Math.floor(Math.random() * 1000000);
  const finalPrompt = prompt + ", 8k resolution, masterpiece, perfect lighting, no text, no typography";
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1080&height=1080&nologo=true&seed=${seed}&model=flux`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Image generation failed');
  return await res.blob();
}

function toast(msg, isError) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  setTimeout(() => (el.className = ''), 4000);
}
function showLoading(txt) { $('#loadingText').textContent = txt; $('#loading').classList.add('show'); }
function hideLoading() { $('#loading').classList.remove('show'); }
function showStep(n) { $$('.step').forEach(el => el.classList.remove('active')); $(`#step${n}`).classList.add('active'); window.scrollTo({top:0, behavior:'smooth'}); }

// Settings
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('sprout_settings') || '{}');
    Object.assign(state.settings, s);
  } catch (_) {}
  $('#geminiKey').value = state.settings.geminiKey || '';
  $('#textModel').value = state.settings.textModel || 'gemini-2.0-flash';
}
function saveSettings() {
  state.settings.geminiKey = $('#geminiKey').value.trim();
  state.settings.textModel = $('#textModel').value.trim() || 'gemini-2.0-flash';
  localStorage.setItem('sprout_settings', JSON.stringify(state.settings));
  toast('✓ Settings saved');
}

// Workflow
async function generatePosts() {
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);
  showLoading('AI is writing 3 options...');
  
  const userMsg = `Brand: ${state.brandName}\nContext: ${state.brandContext}\nGoal: ${TEMPLATES[state.goal].label}\n${TEMPLATES[state.goal].instruction}`;
  const customSystem = SYSTEM_POST.replace('{TONE}', state.tone);

  try {
    const res = await geminiText(customSystem, userMsg, state.settings.geminiKey);
    // Split by the separator we requested
    const options = res.split('===OPTION===').map(s => s.trim()).filter(s => s.length > 10);
    
    if (options.length >= 3) {
      state.postOptions = options.slice(0, 3);
    } else {
      state.postOptions = [res, res, res]; // fallback
    }
    
    selectOption(0);
    showStep(2);
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

function selectOption(index) {
  state.selectedOptionIndex = index;
  $$('.tab').forEach(t => t.classList.remove('active'));
  $(`.tab[data-opt="${index}"]`).classList.add('active');
  $('#postText').value = state.postOptions[index];
}

async function approvePost() {
  state.post = $('#postText').value.trim();
  if (!state.post) return toast('Post is empty', true);
  
  showStep(3);
  await generateImage();
}

async function generateImage() {
  showLoading('Generating background image...');
  
  const styleMap = { photorealistic: "photorealistic", cinematic: "cinematic lighting, movie still", minimalist: "minimalist, clean", "3d_render": "3D render", illustration: "digital illustration" };
  const selectedStyle = styleMap[state.imageStyle];
  
  try {
    const customSystem = SYSTEM_IMAGE_PROMPT.replace('{STYLE}', selectedStyle);
    let prompt = await geminiText(customSystem, `Brand: ${state.brandName}\nContext: ${state.brandContext}\nPost: ${state.post}`, state.settings.geminiKey);
    
    state.imagePrompt = prompt;
    $('#imagePromptInput').value = prompt;
    
    const blob = await generateFreeImage(prompt);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageBlob = blob;
    state.imageUrl = URL.createObjectURL(blob);
    
    const img = new Image();
    img.src = state.imageUrl;
    img.onload = () => {
      state.imageObj = img;
      $('#previewImage').src = state.imageUrl;
    };
    
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

async function updateImageFromPrompt() {
  const p = $('#imagePromptInput').value.trim();
  if (!p) return;
  state.imagePrompt = p;
  showLoading('Updating image...');
  try {
    const blob = await generateFreeImage(p);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageBlob = blob;
    state.imageUrl = URL.createObjectURL(blob);
    
    const img = new Image();
    img.src = state.imageUrl;
    img.onload = () => {
      state.imageObj = img;
      $('#previewImage').src = state.imageUrl;
    };
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

// The Magic: Canvas Text Overlay
function generateFinalPoster() {
  if (!state.imageObj) return toast('Image not ready', true);

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // 1. Draw Image
  ctx.drawImage(state.imageObj, 0, 0, 1080, 1080);

  // 2. Draw Gradient Overlay for text readability
  const gradient = ctx.createLinearGradient(0, 1080, 0, 500);
  gradient.addColorStop(0, 'rgba(0,0,0,0.9)'); // Dark at bottom
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1080);

  // 3. Extract Hook & CTA
  const lines = state.post.split('\n').filter(l => l.trim().length > 0);
  let hook = lines[0] || '';
  if (hook.length > 60) hook = hook.substring(0, 57) + '...';
  
  let cta = "DM us to order!";
  if (state.post.toLowerCase().includes('comment')) cta = "Comment below!";
  else if (state.post.toLowerCase().includes('whatsapp')) cta = "WhatsApp us!";

  // 4. Draw Text
  ctx.textAlign = 'center';
  
  // Hook
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 70px sans-serif';
  ctx.fillText(hook, 540, 850);

  // Brand Name
  ctx.fillStyle = '#10b981'; // Green
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(state.brandName.toUpperCase(), 540, 920);

  // CTA Button
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(340, 960, 400, 80, 40);
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(cta, 540, 1010);

  // 5. Trigger Download
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.brandName.replace(/\s+/g, '-')}-poster.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast('✓ Poster downloaded!');
  }, 'image/jpeg', 0.95);
}

async function approveVisual() {
  $('#finalPost').textContent = state.post;
  $('#finalImage').src = state.imageUrl;
  
  $('#finalChips').innerHTML = `
    <span class="chip">🎯 <strong>${TEMPLATES[state.goal].label}</strong></span>
    <span class="chip">🗣️ <strong>${state.tone.split(' ')[0]}</strong></span>
  `;
  showStep(4);
}

function resetApp() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.postOptions = ['', '', '']; state.post = ''; state.imageObj = null; state.imageUrl = null;
  $('#brandForm').reset();
  showStep(1);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  $('#brandForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.brandName = $('#brandName').value.trim();
    state.brandUrl = $('#brandUrl').value.trim();
    state.goal = $('#goalTemplate').value;
    state.tone = $('#toneTemplate').value;
    state.contentType = $('#contentType').value;
    state.imageStyle = $('#imageStyle').value;
    state.brandContext = $('#brandContext').value.trim();
    
    if (!state.brandName || !state.brandUrl || !state.goal) return toast('Fill required fields', true);
    generatePosts();
  });

  $('#optionTabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab')) {
      selectOption(parseInt(e.target.dataset.opt));
    }
  });

  $('#approvePostBtn').addEventListener('click', approvePost);
  $('#updatePromptBtn').addEventListener('click', updateImageFromPrompt);
  $('#regenVisualBtn').addEventListener('click', () => {
    const basePrompt = state.imagePrompt.split(',')[0];
    $('#imagePromptInput').value = basePrompt; 
    updateImageFromPrompt();
  });
  $('#approveVisualBtn').addEventListener('click', approveVisual);
  $('#downloadPosterBtn').addEventListener('click', generateFinalPoster);
  $('#copyCaptionBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(state.post);
    toast('✓ Caption copied');
  });
  $('#resetBtn').addEventListener('click', resetApp);

  // Settings
  $('#settingsToggle').addEventListener('click', () => $('#settingsPanel').classList.add('open'));
  $('#settingsClose').addEventListener('click', () => $('#settingsPanel').classList.remove('open'));
  ['geminiKey', 'textModel'].forEach(id => $('#'+id).addEventListener('change', saveSettings));
  
  $('#newPostBtn').addEventListener('click', generatePosts);
  $('#revisePostBtn').addEventListener('click', async () => {
    const fb = $('#postFeedback').value;
    if(!fb) return;
    showLoading('Revising...');
    const userMsg = `Here is the post:\n"""\n${state.post}\n"""\nFeedback: ${fb}\nRewrite in Roman Urdu.`;
    const res = await geminiText(`You are an expert writer. Revise based on feedback. Roman Urdu only.`, userMsg, state.settings.geminiKey);
    state.postOptions[state.selectedOptionIndex] = res;
    $('#postText').value = res;
    hideLoading();
  });
});