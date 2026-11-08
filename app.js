/* ============================================================
   Sprout AI Studio — complete standalone PWA
   Text: Gemini v1beta (gemini-2.0-flash) | Image: Pollinations AI (Flux)
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- Goal templates ---------- */
const TEMPLATES = {
  lead_gen: { label: 'Lead Generation', instruction: `GOAL: LEAD GENERATION\n- Hook must address a specific pain point.\n- Body must build trust and state the value.\n- End with a STRONG CTA (DM, form, link, call).\n- Do NOT be salesy.` },
  awareness: { label: 'Brand Awareness / Reach', instruction: `GOAL: BRAND AWARENESS\n- Hook must be bold and shareable.\n- Build brand identity.\n- Avoid direct selling.` },
  engagement: { label: 'Engagement', instruction: `GOAL: ENGAGEMENT\n- Hook must provoke curiosity.\n- End with an open question.\n- Keep it conversational.` },
  launch: { label: 'Product / Service Launch', instruction: `GOAL: LAUNCH\n- Hook must create excitement.\n- Highlight 3-4 key benefits.\n- End with urgency + CTA.` },
  educational: { label: 'Educational / Value Post', instruction: `GOAL: EDUCATIONAL\n- Hook must promise a useful outcome.\n- Deliver real value: tips, steps, framework.\n- End with a soft CTA.` },
  event: { label: 'Event Promotion', instruction: `GOAL: EVENT\n- Include WHAT, WHEN, WHERE, WHO.\n- Create urgency.\n- Clear RSVP CTA.` },
  sale: { label: 'Sale / Offer', instruction: `GOAL: SALE\n- Announce offer with urgency.\n- State discount, deadline, and how to grab.\n- Strong CTA.` }
};

/* ---------- System Prompts ---------- */
const SYSTEM_POST = `You are a professional Facebook content writer. Your only job is to transform brand context and a goal into a compelling, publish-ready Facebook post.
Write like a real human. Adapt your tone to the brand.
IMPORTANT: You MUST write the post in Roman Urdu (Urdu language written in English alphabet). Do not use the Urdu script. Keep the tone natural and conversational, as if a Pakistani social media manager is writing it.
Create a hook. Build a body in 2-4 short paragraphs. Close with a natural CTA. Add 3-5 hashtags.
NEVER use robotic words. NEVER start with "I".
OUTPUT ONLY THE POST TEXT. No markdown, no quotes.`;

const SYSTEM_REVISE = `You are an expert Facebook writer. Revise the post based on human feedback. Keep everything else intact. IMPORTANT: The output must be strictly in Roman Urdu. Output ONLY the revised text.`;

const SYSTEM_NEW_POST = `You are a professional Facebook writer. The human rejected the previous post. Write a completely FRESH post from a different angle. IMPORTANT: The output must be strictly in Roman Urdu. Output ONLY the new text.`;

// Updated: We force Gemini to generate a highly descriptive English prompt and include the brand style
const SYSTEM_IMAGE_PROMPT = `You are an expert AI art director. Analyze the provided social media post (which is in Roman Urdu) and the Brand Context.
Generate a highly detailed, ENGLISH-ONLY image generation prompt that will create a stunning visual for this post.
The image must perfectly match the mood, subject, and colors of the post AND the brand context.
If the brand is clothing, describe the clothes. If it's food, describe the food.
The style must be: {STYLE}.
Describe the lighting, camera angle, and environment in detail.
CRITICAL: Do NOT include any text, letters, or typography in the image.
Output ONLY the English prompt.`;

const SYSTEM_REEL = `You are a reel scriptwriter. Generate a JSON storyboard. The spoken text and on-screen text must be in Roman Urdu. Schema: {"title": "...", "duration": "30s", "hook": {"spoken":"...", "onScreenText":"...", "visual":"..."}, "scenes": [{"timeRange":"3-8s", "spoken":"...", "onScreenText":"...", "visual":"..."}], "cta": {...}, "music": "...", "hashtags": ["..."], "coverPrompt": "a highly detailed English prompt for the cover image, no text"}. Return RAW JSON only.`;

/* ---------- State ---------- */
const state = {
  brandName: '', brandUrl: '', goal: '', contentType: 'image', imageStyle: 'photorealistic',
  brandContext: '', extraNotes: '', post: '', postAttempts: 0,
  visualAttempts: 0, imagePrompt: '', imageBlob: null, imageUrl: null,
  reelScript: null, settings: { geminiKey: '', textModel: 'gemini-2.0-flash' }
};

/* ---------- Gemini API ---------- */
async function geminiText(systemPrompt, userMessage, apiKey, model) {
  let m = model || state.settings.textModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const body = { contents: [{ role: 'user', parts: [{ text: userMessage }] }] };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 404) throw new Error(`404 Error: Model "${m}" nahi mila. Settings mein Text Model ko "gemini-2.0-flash" likhein.`);
    throw new Error('Gemini API Error: ' + errText.slice(0, 150));
  }
  
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text).filter(Boolean).join('').trim();
  if (!text) throw new Error('AI ne koi text generate nahi kiya.');
  return text;
}

/* ---------- Pollinations AI (Free Image Generation - Flux) ---------- */
async function generateFreeImage(prompt) {
  const seed = Math.floor(Math.random() * 1000000);
  
  // Add quality enhancers
  const qualityEnhancers = ", 8k resolution, masterpiece, highly detailed, perfect lighting, social media background";
  const finalPrompt = prompt + qualityEnhancers;
  
  const encodedPrompt = encodeURIComponent(finalPrompt);
  
  // Using Flux model for better quality
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true&seed=${seed}&model=flux`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Free image generation failed. Try again.');
  return await res.blob();
}

/* ---------- Helpers ---------- */
function parseJSON(text) {
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const s = t.indexOf('{'); const e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

let toastTimer;
function toast(msg, isError) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), 5000);
}

function showLoading(text, sub) {
  $('#loadingText').textContent = text || 'Working...';
  $('#loadingSub').textContent = sub || '';
  $('#loading').classList.add('show');
}
function hideLoading() { $('#loading').classList.remove('show'); }

function showStep(n) {
  $$('.step').forEach((el) => el.classList.remove('active'));
  const el = document.getElementById('step' + n);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('sprout_settings') || '{}');
    Object.assign(state.settings, saved);
  } catch (_) {}
  $('#geminiKey').value = state.settings.geminiKey || '';
  $('#textModel').value = state.settings.textModel || 'gemini-2.0-flash';
}

function saveSettings() {
  state.settings = {
    geminiKey: $('#geminiKey').value.trim(),
    textModel: $('#textModel').value.trim() || 'gemini-2.0-flash'
  };
  localStorage.setItem('sprout_settings', JSON.stringify(state.settings));
  toast('✓ Settings saved');
}

function buildBrandBlock() {
  const tpl = TEMPLATES[state.goal];
  return [
    `Brand name: ${state.brandName}`,
    `Website / page: ${state.brandUrl}`,
    tpl ? `GOAL: ${tpl.label}` : '',
    tpl ? tpl.instruction : '',
    state.brandContext ? `Brand context: ${state.brandContext}` : '',
    state.extraNotes ? `Extra instructions: ${state.extraNotes}` : ''
  ].filter(Boolean).join('\n\n');
}

/* ---------- Workflow ---------- */
async function generatePost() {
  if (!state.settings.geminiKey) return toast('Settings me Gemini API key daalein ⚙️', true);
  state.postAttempts = 1;
  $('#postAttemptBadge').textContent = 'Attempt 1';
  await writePost(SYSTEM_POST, buildBrandBlock(), 'Post likhi ja rahi hai...');
}

async function writePost(systemPrompt, userMessage, loadingMsg) {
  showLoading(loadingMsg, 'AI is analyzing your brand...');
  try {
    const post = await geminiText(systemPrompt, userMessage, state.settings.geminiKey);
    state.post = post;
    $('#postText').value = post;
    showStep(2);
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

async function newPost() {
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);
  state.postAttempts++;
  $('#postAttemptBadge').textContent = 'Attempt ' + state.postAttempts;
  const userMsg = `${buildBrandBlock()}\n\n---\n\nPrevious rejected post:\n"""\n${state.post}\n"""\n\nWrite a completely fresh post from a different angle in Roman Urdu.`;
  await writePost(SYSTEM_NEW_POST, userMsg, 'Naya post likha ja raha hai...');
}

async function revisePost() {
  const feedback = $('#postFeedback').value.trim();
  if (!feedback) return toast('Feedback likhein', true);
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  const userMsg = `Here is the post:\n\n"""\n${state.post}\n"""\n\nHere is the human feedback:\n\n${feedback}`;
  showLoading('Post revise ho rahi hai...');
  try {
    const revised = await geminiText(SYSTEM_REVISE, userMsg, state.settings.geminiKey);
    state.post = revised;
    $('#postText').value = revised;
    $('#postFeedback').value = '';
    toast('✓ Post updated');
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

async function approvePost() {
  const edited = $('#postText').value.trim();
  if (!edited) return toast('Post khali hai', true);
  state.post = edited;
  state.visualAttempts = 1;
  $('#visualAttemptBadge').textContent = 'Attempt 1';

  if (state.contentType === 'reel') {
    $('#visualSub').textContent = 'Reel script aur cover image ready hai.';
    $('#reelScriptContainer').classList.remove('hidden');
  } else {
    $('#visualSub').textContent = 'Image ready hai. Agar pasand na aaye to neechay prompt change karein.';
    $('#reelScriptContainer').classList.add('hidden');
  }

  showStep(3);
  await generateVisual();
}

async function generateVisual() {
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  try {
    if (state.contentType === 'reel') {
      showLoading('Reel script likha ja raha hai...', 'Writing storyboard');
      state.reelScript = null;
      let scriptText = '';
      try {
        scriptText = await geminiText(
          SYSTEM_REEL,
          `Brand: ${state.brandName}\nPost:\n"""\n${state.post}\n"""\n\nGenerate the JSON now.`,
          state.settings.geminiKey
        );
        state.reelScript = parseJSON(scriptText);
      } catch (e) {
        throw new Error('Reel script format issue. Try changing text model.');
      }
      renderReelScript(state.reelScript, 'reelScript');

      const coverPrompt = state.reelScript.coverPrompt || `A premium background for ${state.brandName}. No text.`;
      state.imagePrompt = coverPrompt;
      $('#imagePromptInput').value = coverPrompt;

      showLoading('Cover image ban rahi hai...', 'Generating free Flux image');
      const blob = await generateFreeImage(coverPrompt);
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageBlob = blob;
      state.imageUrl = URL.createObjectURL(blob);
      $('#previewImage').src = state.imageUrl;
      $('#previewImage').style.display = 'block';
    } else {
      showLoading('Image prompt ban raha hai...', 'Analyzing post and brand context');
      let imgPrompt = '';
      
      const styleMap = {
        photorealistic: "photorealistic, real life photography",
        cinematic: "cinematic lighting, dramatic shadows, movie still",
        minimalist: "minimalist, clean background, simple, lots of negative space",
        "3d_render": "3D render, octane render, modern digital art",
        illustration: "digital illustration, artistic, painted style"
      };
      const selectedStyle = styleMap[state.imageStyle] || styleMap.photorealistic;

      try {
        // Inject style and context into the system prompt
        const customSystem = SYSTEM_IMAGE_PROMPT.replace('{STYLE}', selectedStyle);
        const userMsg = `Brand: ${state.brandName}\nBrand Context: ${state.brandContext}\nPost:\n"""\n${state.post}\n"""`;
        
        imgPrompt = await geminiText(customSystem, userMsg, state.settings.geminiKey);
      } catch (_) {
        imgPrompt = `A ${selectedStyle} background related to ${state.brandName} (${state.brandContext}). No text.`;
      }
      
      state.imagePrompt = imgPrompt;
      $('#imagePromptInput').value = imgPrompt;

      showLoading('Poster ban raha hai...', 'Generating free Flux image');
      const blob = await generateFreeImage(imgPrompt);
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageBlob = blob;
      state.imageUrl = URL.createObjectURL(blob);
      $('#previewImage').src = state.imageUrl;
      $('#previewImage').style.display = 'block';
    }
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

function renderReelScript(script, containerId) {
  const c = document.getElementById(containerId);
  if (!c || !script) return;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  const sceneHTML = (s) => `
    <div class="reel-scene">
      ${s.timeRange ? `<div class="time">⏱ ${esc(s.timeRange)}</div>` : ''}
      ${s.spoken ? `<div class="row-item"><strong>Voiceover</strong>${esc(s.spoken)}</div>` : ''}
      ${s.onScreenText ? `<div class="row-item"><strong>On-screen</strong>${esc(s.onScreenText)}</div>` : ''}
      ${s.visual ? `<div class="row-item"><strong>Visual</strong>${esc(s.visual)}</div>` : ''}
    </div>`;

  c.innerHTML = `
    <h4>🎬 ${esc(script.title || 'Reel Script')}</h4>
    <div class="reel-scene">
      <div class="time">HOOK</div>
      ${script.hook?.spoken ? `<div class="row-item"><strong>Voiceover</strong>${esc(script.hook.spoken)}</div>` : ''}
      ${script.hook?.visual ? `<div class="row-item"><strong>Visual</strong>${esc(script.hook.visual)}</div>` : ''}
    </div>
    ${(script.scenes || []).map(sceneHTML).join('')}
    <div class="reel-scene">
      <div class="time">CTA</div>
      ${script.cta?.spoken ? `<div class="row-item"><strong>Voiceover</strong>${esc(script.cta.spoken)}</div>` : ''}
      ${script.cta?.visual ? `<div class="row-item"><strong>Visual</strong>${esc(script.cta.visual)}</div>` : ''}
    </div>
  `;
}

async function approveVisual() {
  if (!state.imageBlob) return toast('Visual ready nahi hai', true);

  $('#finalPost').textContent = state.post;
  $('#finalImage').src = state.imageUrl || '';
  $('#finalImage').style.display = state.imageUrl ? 'block' : 'none';

  const chips = [
    `<span class="chip">🎯 <strong>${TEMPLATES[state.goal]?.label || state.goal}</strong></span>`,
    `<span class="chip">${state.contentType === 'reel' ? '🎬 Reel' : '🖼️ Image Post'}</span>`,
    `<span class="chip">🏷 <strong>${state.brandName}</strong></span>`
  ];
  $('#finalChips').innerHTML = chips.join('');

  if (state.contentType === 'reel' && state.reelScript) {
    $('#finalReelContainer').classList.remove('hidden');
    $('#downloadReelBtn').classList.remove('hidden');
    renderReelScript(state.reelScript, 'finalReelScript');
  } else {
    $('#finalReelContainer').classList.add('hidden');
    $('#downloadReelBtn').classList.add('hidden');
  }

  showStep(4);
  toast('✓ Aap ki post tayar hai!');
}

// NAYA: Regenerate button se pehle prompt update hota hai
async function updateImageFromPrompt() {
  const newPrompt = $('#imagePromptInput').value.trim();
  if (!newPrompt) return toast('Prompt khali hai', true);
  
  state.imagePrompt = newPrompt;
  state.visualAttempts++;
  $('#visualAttemptBadge').textContent = 'Attempt ' + state.visualAttempts;

  showLoading('Nayi image ban rahi hai...', 'Generating based on your prompt');
  try {
    const blob = await generateFreeImage(newPrompt);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageBlob = blob;
    state.imageUrl = URL.createObjectURL(blob);
    $('#previewImage').src = state.imageUrl;
    toast('✓ Naya image ready');
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

async function regenerateVisual() {
  updateImageFromPrompt(); // Just use the prompt in the box
}

async function applyVisualFeedback() {
  const fb = $('#visualFeedback').value.trim();
  if (!fb) return toast('Feedback likhein', true);
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  showLoading('Feedback apply ho raha hai...', 'Refining the prompt');
  try {
    const refinedPrompt = await geminiText(
      `You are an image prompt engineer. Rewrite this ENGLISH prompt based on feedback. Output ONLY the new English prompt.`,
      `Current prompt:\n"""\n${state.imagePrompt}\n"""\n\nFeedback:\n"""\n${fb}\n"""`,
      state.settings.geminiKey
    );
    
    state.imagePrompt = refinedPrompt;
    $('#imagePromptInput').value = refinedPrompt; // Update the text box
    $('#visualFeedback').value = '';
    
    // Auto-generate new image
    updateImageFromPrompt();
    
  } catch (e) {
    toast(e.message, true);
    hideLoading();
  }
}

/* ---------- Downloads / Copy ---------- */
function downloadImage() {
  if (!state.imageUrl) return toast('Image available nahi', true);
  const a = document.createElement('a');
  a.href = state.imageUrl;
  a.download = `poster-${Date.now()}.png`;
  a.click();
}

function downloadCaption() {
  const blob = new Blob([state.post], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `caption-${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReelScript() {
  if (!state.reelScript) return toast('Reel script nahi hai', true);
  const txt = JSON.stringify(state.reelScript, null, 2);
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reel-script-${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyCaption() {
  navigator.clipboard.writeText(state.post)
    .then(() => toast('✓ Caption copied'))
    .catch(() => toast('Copy fail', true));
}

function resetApp() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.post = ''; state.postAttempts = 0; state.visualAttempts = 0;
  state.imagePrompt = ''; state.imageBlob = null; state.imageUrl = null; state.reelScript = null;

  $('#brandForm').reset();
  $('#postText').value = ''; $('#postFeedback').value = ''; $('#visualFeedback').value = '';
  $('#imagePromptInput').value = '';
  $('#previewImage').src = ''; $('#previewImage').style.display = 'none';
  $('#reelScriptContainer').classList.add('hidden'); $('#reelScript').innerHTML = '';
  $('#postAttemptBadge').textContent = 'Attempt 1'; $('#visualAttemptBadge').textContent = 'Attempt 1';

  showStep(1);
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  showStep(1);

  $('#brandForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#brandName').value.trim();
    const url = $('#brandUrl').value.trim();
    const goal = $('#goalTemplate').value;
    if (!name || !url || !goal) return toast('Tamam required fields bharein', true);
    if (!state.settings.geminiKey) return toast('Settings me Gemini API key daalein ⚙️', true);

    state.brandName = name; state.brandUrl = url; state.goal = goal;
    state.contentType = $('#contentType').value;
    state.imageStyle = $('#imageStyle').value;
    state.brandContext = $('#brandContext').value.trim();
    state.extraNotes = $('#extraNotes').value.trim();

    generatePost();
  });

  $('#approvePostBtn').addEventListener('click', approvePost);
  $('#newPostBtn').addEventListener('click', newPost);
  $('#revisePostBtn').addEventListener('click', revisePost);
  $('#approveVisualBtn').addEventListener('click', approveVisual);
  
  // Yahan humne naye buttons attach kiye hain
  $('#regenVisualBtn').addEventListener('click', updateImageFromPrompt); 
  $('#updatePromptBtn').addEventListener('click', updateImageFromPrompt);
  
  $('#applyVisualFeedbackBtn').addEventListener('click', applyVisualFeedback);
  $('#downloadImageBtn').addEventListener('click', downloadImage);
  $('#downloadCaptionBtn').addEventListener('click', downloadCaption);
  $('#downloadReelBtn').addEventListener('click', downloadReelScript);
  $('#copyCaptionBtn').addEventListener('click', copyCaption);
  $('#resetBtn').addEventListener('click', resetApp);

  $('#settingsToggle').addEventListener('click', () => $('#settingsPanel').classList.add('open'));
  $('#settingsClose').addEventListener('click', () => $('#settingsPanel').classList.remove('open'));
  
  ['geminiKey', 'textModel'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveSettings);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});