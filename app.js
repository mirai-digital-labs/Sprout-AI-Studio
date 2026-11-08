/* ============================================================
   Sprout AI Studio — complete standalone PWA
   AI Post (Gemini) + Image (Pollinations AI) with approvals
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- Goal templates ---------- */
const TEMPLATES = {
  lead_gen: {
    label: 'Lead Generation',
    instruction: `GOAL: LEAD GENERATION\n- Hook must address a specific pain point.\n- Body must build trust and state the value.\n- End with a STRONG CTA (DM, form, link, call).\n- Do NOT be salesy or cringe. Be confident, clear, human.`
  },
  awareness: {
    label: 'Brand Awareness / Reach',
    instruction: `GOAL: BRAND AWARENESS & REACH\n- Hook must be bold, surprising, or emotionally resonant.\n- Highly shareable: short, punchy, memorable lines.\n- Build brand identity and personality.\n- End with a share or tag prompt.\n- Avoid direct selling.`
  },
  engagement: {
    label: 'Engagement',
    instruction: `GOAL: ENGAGEMENT (Comments, Likes, Shares)\n- Hook must provoke curiosity or emotion.\n- Body should invite opinions, stories, or relatable experiences.\n- End with an open, easy-to-answer question.\n- Encourage tagging or sharing.\n- Keep it conversational and warm.`
  },
  launch: {
    label: 'Product / Service Launch',
    instruction: `GOAL: PRODUCT / SERVICE LAUNCH\n- Hook must create excitement about the new offering.\n- Highlight 3–4 KEY BENEFITS in plain language.\n- Show what problem it solves.\n- End with urgency plus a clear next-step CTA.`
  },
  educational: {
    label: 'Educational / Value Post',
    instruction: `GOAL: EDUCATIONAL / VALUE POST\n- Hook must promise a specific, useful outcome.\n- Deliver REAL value: tips, steps, a framework, or insight.\n- Use a short, scannable structure.\n- Establish the brand as a trusted expert.\n- End with a soft CTA: follow, save, or DM for more.`
  },
  event: {
    label: 'Event Promotion',
    instruction: `GOAL: EVENT PROMOTION\n- Hook must convey WHAT, WHEN, WHERE, and WHO.\n- Create urgency (limited seats, deadline).\n- End with a clear registration / RSVP CTA.\n- Tone should be exciting and invite action.`
  },
  sale: {
    label: 'Sale / Offer',
    instruction: `GOAL: SALE / OFFER\n- Hook must announce the offer with urgency.\n- Clearly state: what's on offer, the discount, the deadline, and how to grab it.\n- Use specific numbers, prices, or percentages.\n- End with a strong, urgent CTA.`
  }
};

/* ---------- System Prompts ---------- */
const SYSTEM_POST = `You are a professional Facebook content writer. Your only job is to receive brand context and a goal, and transform it into a compelling, publish-ready Facebook post.
You write like a real human — someone who deeply understands social media. You adapt your tone to match the nature of the brand and the goal.

WHAT YOU WILL RECEIVE:
- Brand name, website / page link, and optional brand context.
- A GOAL.
- Optional extra instructions.

YOUR JOB:
1. Understand the audience, tone, and personality.
2. Create a hook — a single first line that stops scrollers.
3. Build the body in 2–4 short paragraphs. Short line breaks.
4. Close with a natural, non-cringy CTA matching the GOAL.
5. Add 3–5 relevant hashtags.

TONE RULES:
- NEVER use robotic words: "cutting-edge", "synergy", "game-changer", "revolutionize", "unleash", "elevate", "in today's fast-paced world".
- No placeholders like [Your Name] or [Link].
- NEVER start the post with "I".
- No emojis unless the tone clearly benefits.
- Use line breaks generously.

OUTPUT RULES (STRICT):
- Output ONLY the final Facebook post text.
- Do NOT say "Here is your post".
- No markdown headings, no surrounding quotes.
- The output must be 100% copy-paste ready for Facebook.`;

const SYSTEM_REVISE = `You are an expert Facebook writer. Your job is to take an incoming post and revise it based on the feedback the human submitted.
Apply the feedback precisely to the existing post. Keep everything that was not mentioned in the feedback.
Output ONLY the final revised post text. No commentary.`;

const SYSTEM_NEW_POST = `You are a professional Facebook content writer. The human has rejected the previous attempt and wants a FRESH post from a different angle.
Do NOT rewrite the previous post. Start completely fresh. Use a new hook, new body, new angle.
Keep the same brand, goal, and audience.
Output ONLY the final Facebook post text.`;

const SYSTEM_IMAGE_PROMPT = `You are an expert creative director. Analyze the Facebook post and the brand, and generate a detailed image prompt for creating a premium visual background for the post.
INSTRUCTIONS:
- Understand the message, theme, and mood.
- Create a strong visual concept.
- Modern, premium, clean look.
- Do NOT include any text, typography, or logos.
- Output ONLY the final image prompt. No explanations.`;

const SYSTEM_REEL = `You are an expert short-form video (reel) scriptwriter. Generate a detailed, shot-by-shot reel script based on the Facebook post and the brand context.
OUTPUT FORMAT — return valid JSON ONLY with this exact schema:
{
  "title": "short reel title",
  "duration": "30s",
  "hook": { "spoken": "...", "onScreenText": "...", "visual": "..." },
  "scenes": [ { "timeRange": "3-8s", "spoken": "...", "onScreenText": "...", "visual": "..." } ],
  "cta": { "spoken": "...", "onScreenText": "...", "visual": "..." },
  "music": "genre suggestion",
  "hashtags": ["...", "..."],
  "coverPrompt": "a detailed prompt for the cover image (no text)"
}
No markdown, no commentary — return raw valid JSON only.`;

/* ---------- State ---------- */
const state = {
  brandName: '', brandUrl: '', goal: '', contentType: 'image',
  brandContext: '', extraNotes: '', post: '', postAttempts: 0,
  visualAttempts: 0, imagePrompt: '', imageBlob: null, imageUrl: null,
  reelScript: null, settings: { geminiKey: '', textModel: 'gemini-1.5-flash' }
};

/* ---------- Gemini API ---------- */
async function geminiText(systemPrompt, userMessage, apiKey, model) {
  const m = model || state.settings.textModel || 'gemini-1.5-flash';
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
    if (res.status === 404) throw new Error('404: Model not found. Please change Text Model in Settings (e.g., gemini-1.5-flash or gemini-2.0-flash)');
    throw new Error('Gemini API: ' + errText.slice(0, 150));
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text).filter(Boolean).join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

/* ---------- Pollinations AI (Free Image Generation) ---------- */
async function generateFreeImage(prompt) {
  // Generate a random seed for varied results
  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&nologo=true&seed=${seed}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Free image generation failed. Please try again.');
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
  $('#textModel').value = state.settings.textModel || '';
}

function saveSettings() {
  state.settings = {
    geminiKey: $('#geminiKey').value.trim(),
    textModel: $('#textModel').value.trim() || 'gemini-1.5-flash'
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
  const userMsg = `${buildBrandBlock()}\n\n---\n\nThe previous post was REJECTED. Write a completely fresh post from a different angle — new hook, new structure, new approach. Do NOT reuse the rejected version.\n\nRejected post:\n"""\n${state.post}\n"""`;
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
    $('#visualSub').textContent = 'Reel script aur cover image ready hai. Dono review karein.';
    $('#reelScriptContainer').classList.remove('hidden');
  } else {
    $('#visualSub').textContent = 'Image ready hai. Pasand aye to approve karein, warna regenerate karein.';
    $('#reelScriptContainer').classList.add('hidden');
  }

  showStep(3);
  await generateVisual();
}

async function generateVisual() {
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  try {
    if (state.contentType === 'reel') {
      showLoading('Reel script likha ja raha hai...', 'AI is writing the storyboard');
      state.reelScript = null;
      let scriptText = '';
      try {
        scriptText = await geminiText(
          SYSTEM_REEL,
          `Brand: ${state.brandName}\nURL: ${state.brandUrl}\nGoal: ${state.goal}\nPost:\n"""\n${state.post}\n"""\n\nGenerate the reel JSON now.`,
          state.settings.geminiKey
        );
        state.reelScript = parseJSON(scriptText);
      } catch (e) {
        console.warn('Reel JSON parse failed:', e, scriptText);
        throw new Error('Reel script format issue — please retry or change text model in settings.');
      }
      renderReelScript(state.reelScript, 'reelScript');

      const coverPrompt = state.reelScript.coverPrompt || `A clean, premium vertical background image for a reel about: ${state.brandName}. No text, no typography. Cinematic lighting.`;
      state.imagePrompt = coverPrompt;

      showLoading('Reel cover image ban rahi hai...', 'This may take 10-20 seconds');
      const blob = await generateFreeImage(coverPrompt);
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageBlob = blob;
      state.imageUrl = URL.createObjectURL(blob);
      $('#previewImage').src = state.imageUrl;
      $('#previewImage').style.display = 'block';
      $('#imagePromptDisplay').textContent = coverPrompt;
    } else {
      showLoading('Image prompt ban raha hai...', 'Analyzing post theme');
      let imgPrompt = '';
      try {
        imgPrompt = await geminiText(
          SYSTEM_IMAGE_PROMPT,
          `Brand: ${state.brandName}\nPost:\n"""\n${state.post}\n"""`,
          state.settings.geminiKey
        );
      } catch (_) {
        imgPrompt = `A clean modern background illustration for ${state.brandName}, no text, cinematic lighting, premium feel`;
      }
      state.imagePrompt = imgPrompt;

      showLoading('Poster ban raha hai...', 'Free AI is generating your image');
      const blob = await generateFreeImage(imgPrompt);
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageBlob = blob;
      state.imageUrl = URL.createObjectURL(blob);
      $('#previewImage').src = state.imageUrl;
      $('#previewImage').style.display = 'block';
      $('#imagePromptDisplay').textContent = imgPrompt;
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
    <h4>🎬 ${esc(script.title || 'Reel Script')} ${script.duration ? `· ${esc(script.duration)}` : ''}</h4>
    <div class="reel-scene">
      <div class="time">⏱ 0-3s · HOOK</div>
      ${script.hook?.spoken ? `<div class="row-item"><strong>Voiceover</strong>${esc(script.hook.spoken)}</div>` : ''}
      ${script.hook?.onScreenText ? `<div class="row-item"><strong>On-screen</strong>${esc(script.hook.onScreenText)}</div>` : ''}
      ${script.hook?.visual ? `<div class="row-item"><strong>Visual</strong>${esc(script.hook.visual)}</div>` : ''}
    </div>
    ${(script.scenes || []).map(sceneHTML).join('')}
    <div class="reel-scene">
      <div class="time">⏱ 25-30s · CTA</div>
      ${script.cta?.spoken ? `<div class="row-item"><strong>Voiceover</strong>${esc(script.cta.spoken)}</div>` : ''}
      ${script.cta?.onScreenText ? `<div class="row-item"><strong>On-screen</strong>${esc(script.cta.onScreenText)}</div>` : ''}
      ${script.cta?.visual ? `<div class="row-item"><strong>Visual</strong>${esc(script.cta.visual)}</div>` : ''}
    </div>
    ${script.music ? `<div class="reel-scene"><div class="time">🎵 MUSIC</div><div class="row-item">${esc(script.music)}</div></div>` : ''}
    ${(script.hashtags || []).length ? `<div class="reel-scene"><div class="time"># HASHTAGS</div><div class="row-item">${script.hashtags.map((h) => '#' + esc(h.replace(/^#/, ''))).join(' ')}</div></div>` : ''}
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

async function regenerateVisual() {
  state.visualAttempts++;
  $('#visualAttemptBadge').textContent = 'Attempt ' + state.visualAttempts;

  if (state.contentType === 'reel') {
    showLoading('Naya cover image ban raha hai...');
    try {
      const blob = await generateFreeImage(state.imagePrompt);
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageBlob = blob;
      state.imageUrl = URL.createObjectURL(blob);
      $('#previewImage').src = state.imageUrl;
      toast('✓ Naya cover ready');
    } catch (e) {
      toast(e.message, true);
    } finally {
      hideLoading();
    }
    return;
  }

  showLoading('Naya image ban raha hai...', 'Free AI is regenerating');
  try {
    const blob = await generateFreeImage(state.imagePrompt);
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

async function applyVisualFeedback() {
  const fb = $('#visualFeedback').value.trim();
  if (!fb) return toast('Feedback likhein', true);
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  state.visualAttempts++;
  $('#visualAttemptBadge').textContent = 'Attempt ' + state.visualAttempts;

  showLoading('Feedback apply ho raha hai...', 'Refining the image prompt');
  try {
    const refinedPrompt = await geminiText(
      `You are an image prompt engineer. Take the current image prompt and the human feedback, and rewrite the prompt to reflect the feedback. Output ONLY the new prompt.`,
      `Current prompt:\n"""\n${state.imagePrompt}\n"""\n\nHuman feedback:\n"""\n${fb}\n"""`,
      state.settings.geminiKey
    );
    state.imagePrompt = refinedPrompt;
    $('#imagePromptDisplay').textContent = refinedPrompt;

    showLoading('Naya image ban raha hai...');
    const blob = await generateFreeImage(refinedPrompt);
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
    state.imageBlob = blob;
    state.imageUrl = URL.createObjectURL(blob);
    $('#previewImage').src = state.imageUrl;
    $('#visualFeedback').value = '';
    toast('✓ Image updated');
  } catch (e) {
    toast(e.message, true);
  } finally {
    hideLoading();
  }
}

/* ---------- Downloads / Copy ---------- */
function downloadImage() {
  if (!state.imageUrl) return toast('Image available nahi', true);
  const a = document.createElement('a');
  a.href = state.imageUrl;
  a.download = `${slug(state.brandName) || 'poster'}-${Date.now()}.png`;
  a.click();
}

function downloadCaption() {
  const blob = new Blob([state.post], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(state.brandName) || 'caption'}-${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadReelScript() {
  if (!state.reelScript) return toast('Reel script nahi hai', true);
  const txt = formatReelAsText(state.reelScript);
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reel-script-${Date.now()}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatReelAsText(s) {
  const L = [];
  L.push(`REEL SCRIPT: ${s.title || ''}`);
  L.push(`Duration: ${s.duration || '30s'}\n`);
  L.push('--- HOOK (0-3s) ---');
  if (s.hook?.spoken) L.push(`Voiceover: ${s.hook.spoken}`);
  if (s.hook?.onScreenText) L.push(`On-screen: ${s.hook.onScreenText}`);
  if (s.hook?.visual) L.push(`Visual: ${s.hook.visual}`);
  L.push('');
  (s.scenes || []).forEach((sc, i) => {
    L.push(`--- SCENE ${i + 1} (${sc.timeRange || ''}) ---`);
    if (sc.spoken) L.push(`Voiceover: ${sc.spoken}`);
    if (sc.onScreenText) L.push(`On-screen: ${sc.onScreenText}`);
    if (sc.visual) L.push(`Visual: ${sc.visual}`);
    L.push('');
  });
  L.push('--- CTA (last 5s) ---');
  if (s.cta?.spoken) L.push(`Voiceover: ${s.cta.spoken}`);
  if (s.cta?.onScreenText) L.push(`On-screen: ${s.cta.onScreenText}`);
  if (s.cta?.visual) L.push(`Visual: ${s.cta.visual}`);
  L.push('');
  if (s.music) L.push(`Music: ${s.music}`);
  if (s.hashtags?.length) L.push(`Hashtags: ${s.hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}`);
  return L.join('\n');
}

function copyCaption() {
  navigator.clipboard.writeText(state.post)
    .then(() => toast('✓ Caption copied to clipboard'))
    .catch(() => toast('Copy fail — manually select karein', true));
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/* ---------- Reset ---------- */
function resetApp() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.post = ''; state.postAttempts = 0; state.visualAttempts = 0;
  state.imagePrompt = ''; state.imageBlob = null; state.imageUrl = null; state.reelScript = null;

  $('#brandForm').reset();
  $('#postText').value = ''; $('#postFeedback').value = ''; $('#visualFeedback').value = '';
  $('#previewImage').src = ''; $('#previewImage').style.display = 'none';
  $('#reelScriptContainer').classList.add('hidden'); $('#reelScript').innerHTML = '';
  $('#imagePromptDisplay').textContent = '';
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
    if (!name) return toast('Brand name required', true);
    if (!url) return toast('Website / page link required', true);
    if (!goal) return toast('Goal template select karein', true);
    if (!state.settings.geminiKey) return toast('Settings me Gemini API key daalein ⚙️', true);

    state.brandName = name; state.brandUrl = url; state.goal = goal;
    state.contentType = $('#contentType').value;
    state.brandContext = $('#brandContext').value.trim();
    state.extraNotes = $('#extraNotes').value.trim();

    generatePost();
  });

  $('#approvePostBtn').addEventListener('click', approvePost);
  $('#newPostBtn').addEventListener('click', newPost);
  $('#revisePostBtn').addEventListener('click', revisePost);

  $('#approveVisualBtn').addEventListener('click', approveVisual);
  $('#regenVisualBtn').addEventListener('click', regenerateVisual);
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