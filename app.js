/* ============================================================
   Sprout AI Studio — standalone PWA
   AI Facebook post + visual generator with human approval loops
   ============================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- Goal templates (from the transcript's system prompts, adapted) ---------- */

const TEMPLATES = {
  lead_gen: {
    label: 'Lead Generation',
    instruction: `GOAL: LEAD GENERATION
- The hook must immediately speak to a specific pain point or strong desire of the target audience.
- The body must build trust and clearly state the value being offered.
- End with a STRONG, SPECIFIC call-to-action: DM us, fill the form, click the link, WhatsApp, or call.
- Add a subtle sense of urgency or limited availability if appropriate.
- Do NOT be salesy or cringe. Be confident, clear, and human.`
  },
  awareness: {
    label: 'Brand Awareness / Reach',
    instruction: `GOAL: BRAND AWARENESS & REACH
- The hook must be bold, surprising, or emotionally resonant — designed to stop scrollers.
- The content must be highly shareable: short, punchy, memorable lines.
- Build the brand's identity and personality.
- End with a share or tag prompt to increase organic reach.
- Avoid direct selling; focus on the brand story and positioning.`
  },
  engagement: {
    label: 'Engagement',
    instruction: `GOAL: ENGAGEMENT (Comments, Likes, Shares)
- The hook must provoke curiosity or emotion.
- The body should invite opinions, stories, or relatable experiences.
- End with an open, easy-to-answer question that sparks conversation.
- Encourage tagging or sharing with a specific audience.
- Keep it conversational, warm, and very human.`
  },
  launch: {
    label: 'Product / Service Launch',
    instruction: `GOAL: PRODUCT / SERVICE LAUNCH
- The hook must create excitement and curiosity about the new offering.
- The body must highlight 3–4 KEY BENEFITS (not just features) in plain, everyday language.
- Show what problem it solves and for whom.
- End with urgency plus a clear next-step CTA.
- Mention availability, launch offer, or early-bird discount if relevant.`
  },
  educational: {
    label: 'Educational / Value Post',
    instruction: `GOAL: EDUCATIONAL / VALUE POST
- The hook must promise a specific, useful outcome for the reader.
- The body must deliver REAL value: tips, steps, a framework, or a fresh insight.
- Use a short, scannable structure — numbered tips or mini-sections.
- Establish the brand as a trusted expert without bragging.
- End with a soft CTA: follow, save, share, or DM for more.`
  },
  event: {
    label: 'Event Promotion',
    instruction: `GOAL: EVENT PROMOTION
- The hook must convey what's happening and why it matters.
- The body must include: WHAT, WHEN, WHERE (or online), WHO should attend, and WHAT they'll gain.
- Create urgency (limited seats, registration deadline, etc.).
- End with a clear registration / RSVP CTA.
- The tone should be exciting and invite action.`
  },
  sale: {
    label: 'Sale / Offer',
    instruction: `GOAL: SALE / OFFER
- The hook must announce the offer with urgency and excitement.
- The body must clearly state: what's on offer, the discount/benefit, the deadline, and how to grab it.
- Use specific numbers, prices, or percentages if provided.
- End with a strong, urgent CTA (Buy Now, DM us, Click the link).
- Avoid generic filler — every line must sell.`
  }
};

/* ---------- Core system prompts ---------- */

const SYSTEM_POST = `You are a professional Facebook content writer operating inside an automated workflow for a brand. Your only job is to receive brand context and a goal, and transform it into a compelling, publish-ready Facebook post.

You write like a real human — someone who deeply understands social media and knows how to make content land. You adapt your tone to match the nature of the brand and the goal.

WHAT YOU WILL RECEIVE:
- Brand name, website / page link, and optional brand context.
- A GOAL (Lead Generation, Brand Awareness, Engagement, Launch, Educational, Event, or Sale).
- Optional extra instructions.

YOUR JOB:
1. Read the brand info carefully and understand the audience, tone, and personality.
2. Create a hook — a single first line that stops scrollers.
3. Build the body in 2–4 short paragraphs. Short line breaks. Mix short and medium sentences. No wall of text.
4. Close with engagement — a natural, non-cringy CTA that matches the GOAL.
5. Add 3–5 relevant hashtags at the end.

TONE RULES:
- Adapt the tone to the brand. A coffee brand is warm; a SaaS is crisp; a luxury brand is restrained.
- NEVER use robotic words: "cutting-edge", "synergy", "game-changer", "revolutionize", "unleash", "elevate", "in today's fast-paced world", "level up", "dive in", "game-changing".
- No placeholders like [Your Name] or [Link].
- NEVER start the post with "I".
- No emojis unless the tone clearly benefits. Prefer clean, elegant formatting.
- Use line breaks generously — short paragraphs only.

OUTPUT RULES (STRICT):
- Output ONLY the final Facebook post text.
- Do NOT say "Here is your post", "Sure!", or anything similar.
- No markdown headings, no surrounding quotes.
- The output must be 100% copy-paste ready for Facebook.`;

const SYSTEM_REVISE = `You are an expert Facebook writer. Your job is to take an incoming post and revise it based on the feedback the human submitted.

Apply the feedback precisely to the existing post. Keep everything that was not mentioned in the feedback. Improve only what was asked.

RULES:
- Do not rewrite the entire post from scratch if the feedback is a targeted change.
- Keep the same voice and tone unless the feedback explicitly asks to change it.
- Output ONLY the final revised post text.
- No "Here is your revised post", "Sure!", or any commentary.`;

const SYSTEM_NEW_POST = `You are a professional Facebook content writer. The human has rejected the previous attempt and wants a FRESH post from a different angle.

INSTRUCTIONS:
- Do NOT rewrite the previous post. Start completely fresh.
- Use a new hook, new body structure, new angle.
- Keep the same brand, goal, and audience.
- Follow all the same rules: real-human tone, short paragraphs, no robotic words, no placeholders, no starting with "I", clean formatting.
- Output ONLY the final Facebook post text — 100% copy-paste ready.`;

const SYSTEM_IMAGE_PROMPT = `You are an expert creative director. Analyze the Facebook post and the brand, and generate a detailed image prompt for creating a premium visual background for the post.

INSTRUCTIONS:
- Understand the main message, theme, and mood of the post.
- Create a strong visual concept that matches the brand's personality and the goal.
- Use a modern, premium, clean look — cinematic lighting, depth, tasteful color palette.
- Identify relevant illustrations, objects, or scenes.
- Leave sufficient negative space where text could later be added.
- Do NOT include any text, typography, headlines, logos, or captions in the image.
- Output ONLY the final image prompt — no explanations, no quotes, no markdown.`;

const SYSTEM_REEL = `You are an expert short-form video (reel) scriptwriter. Generate a detailed, shot-by-shot reel script based on the Facebook post and the brand context.

STRUCTURE (30 seconds total unless otherwise specified):
- HOOK (0–3s): a scroll-stopping opening.
- BODY (3–25s): 3–5 quick scenes.
- CTA (25–30s): a clear call-to-action.

OUTPUT FORMAT — return valid JSON ONLY with this exact schema:
{
  "title": "short reel title (max 60 chars)",
  "duration": "30s",
  "hook": { "spoken": "...", "onScreenText": "...", "visual": "..." },
  "scenes": [
    { "timeRange": "3-8s", "spoken": "...", "onScreenText": "...", "visual": "..." }
  ],
  "cta": { "spoken": "...", "onScreenText": "...", "visual": "..." },
  "music": "genre / mood suggestion",
  "hashtags": ["...", "..."],
  "coverPrompt": "a detailed prompt for the cover image (no text, no typography)"
}

RULES:
- No markdown, no commentary — return raw valid JSON only.
- On-screen text must be short: max 8 words per scene.
- Spoken lines must be natural, conversational, fast-paced.
- Visuals must be concrete and shootable on a phone.
- If the user asks for a different duration, adjust the time ranges accordingly.`;

/* ---------- State ---------- */

const state = {
  brandName: '',
  brandUrl: '',
  goal: '',
  contentType: 'image',
  brandContext: '',
  extraNotes: '',
  post: '',
  postAttempts: 0,
  visualAttempts: 0,
  imagePrompt: '',
  imageBlob: null,
  imageUrl: null,
  reelScript: null,
  reelCoverBlob: null,
  reelCoverUrl: null,
  settings: {
    geminiKey: '',
    textModel: 'gemini-2.0-flash',
    imageModel: 'gemini-2.5-flash-image-preview'
  }
};

/* ---------- Gemini API ---------- */

async function geminiText(systemPrompt, userMessage, apiKey, model) {
  const m = model || state.settings.textModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const body = { contents: [{ role: 'user', parts: [{ text: userMessage }] }] };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Gemini: ' + (await res.text()).slice(0, 240));
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text).filter(Boolean).join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function geminiImage(prompt, apiKey, model) {
  const m = model || state.settings.imageModel || 'gemini-2.5-flash-image-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Image: ' + (await res.text()).slice(0, 240));
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const part = parts.find((p) => p.inlineData);
  if (!part) throw new Error('No image returned');
  const base64 = part.inlineData.data;
  const mime = part.inlineData.mimeType || 'image/png';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/* ---------- Helpers ---------- */

function parseJSON(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

let toastTimer;
function toast(msg, isError) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ''), 4200);
}

function showLoading(text, sub) {
  $('#loadingText').textContent = text || 'Working...';
  $('#loadingSub').textContent = sub || '';
  $('#loading').classList.add('show');
}
function hideLoading() {
  $('#loading').classList.remove('show');
}

function showStep(n) {
  $$('.step').forEach((el) => el.classList.remove('active'));
  const el = document.getElementById('step' + n);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- Settings persistence ---------- */

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('sprout_settings') || '{}');
    Object.assign(state.settings, saved);
  } catch (_) {}
  $('#geminiKey').value = state.settings.geminiKey || '';
  $('#textModel').value = state.settings.textModel || '';
  $('#imageModel').value = state.settings.imageModel || '';
}

function saveSettings() {
  state.settings = {
    geminiKey: $('#geminiKey').value.trim(),
    textModel: $('#textModel').value.trim() || 'gemini-2.0-flash',
    imageModel: $('#imageModel').value.trim() || 'gemini-2.5-flash-image-preview'
  };
  localStorage.setItem('sprout_settings', JSON.stringify(state.settings));
  toast('✓ Settings saved');
}

/* ---------- Build user messages ---------- */

function buildBrandBlock() {
  const tpl = TEMPLATES[state.goal];
  return [
    `Brand name: ${state.brandName}`,
    `Website / page: ${state.brandUrl}`,
    tpl ? `GOAL: ${tpl.label}` : '',
    tpl ? tpl.instruction : '',
    state.brandContext ? `Brand context: ${state.brandContext}` : '',
    state.extraNotes ? `Extra instructions: ${state.extraNotes}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

/* ---------- Workflow: STEP 1 → 2 ---------- */

async function generatePost() {
  if (!state.settings.geminiKey) {
    toast('Settings me Gemini API key daalein ⚙️', true);
    return;
  }
  state.postAttempts = 1;
  $('#postAttemptBadge').textContent = 'Attempt 1';
  await writePost(SYSTEM_POST, buildBrandBlock(), 'Post likhi ja rahi hai...');
}

async function writePost(systemPrompt, userMessage, loadingMsg) {
  showLoading(loadingMsg, 'Gemini is analyzing your brand…');
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
  const prev = state.post;
  const userMsg = `${buildBrandBlock()}\n\n---\n\nThe previous post was REJECTED. Write a completely fresh post from a different angle — new hook, new structure, new approach. Do NOT reuse the rejected version.\n\nRejected post (for context only):\n"""\n${prev}\n"""`;
  await writePost(SYSTEM_NEW_POST, userMsg, 'Naya post likha ja raha hai…');
}

async function revisePost() {
  const feedback = $('#postFeedback').value.trim();
  if (!feedback) return toast('Feedback likhein', true);
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  const userMsg = `Here is the post:\n\n"""\n${state.post}\n"""\n\nHere is the human feedback:\n\n${feedback}`;
  showLoading('Post revise ho rahi hai…');
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

/* ---------- STEP 2 → 3 ---------- */

async function approvePost() {
  const edited = $('#postText').value.trim();
  if (!edited) return toast('Post khali hai', true);
  state.post = edited;
  state.visualAttempts = 1;
  $('#visualAttemptBadge').textContent = 'Attempt 1';

  // Set step 3 header text
  if (state.contentType === 'reel') {
    $('#visualSub').textContent =
      'Reel script aur cover image ready hai. Dono review karein. Pasand aye to approve karein, warna regenerate karein.';
    $('#reelScriptContainer').classList.remove('hidden');
  } else {
    $('#visualSub').textContent =
      'Image ready hai. Pasand aye to approve karein, warna regenerate karein.';
    $('#reelScriptContainer').classList.add('hidden');
  }

  showStep(3);
  await generateVisual();
}

async function generateVisual() {
  if (!state.settings.geminiKey) return toast('API key missing ⚙️', true);

  try {
    if (state.contentType === 'reel') {
      // --- REEL FLOW ---
      showLoading('Reel script likha ja raha hai…', 'AI is writing the storyboard');
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
        throw new Error('Reel script format issue — retry');
      }
      renderReelScript(state.reelScript, 'reelScript');

      // --- reel cover image ---
      const coverPrompt =
        state.reelScript.coverPrompt ||
        `A clean, premium vertical background image for a reel about: ${state.brandName}. Theme: ${TEMPLATES[state.goal]?.label}. No text, no typography. Cinematic lighting, modern aesthetic.`;
      state.imagePrompt = coverPrompt;

      showLoading('Reel cover image ban rahi hai…');
      const blob = await geminiImage(coverPrompt, state.settings.geminiKey);
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageBlob = blob;
      state.imageUrl = URL.createObjectURL(blob);
      $('#previewImage').src = state.imageUrl;
      $('#previewImage').style.display = 'block';
      $('#imagePromptDisplay').textContent = coverPrompt;
    } else {
      // --- IMAGE FLOW ---
      showLoading('Image prompt ban raha hai…', 'Analyzing post theme');
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

      showLoading('Poster ban raha hai…', 'This may take 15–30 seconds');
      const blob = await geminiImage(imgPrompt, state.settings.geminiKey);
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
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])
  );

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

/* ---------- STEP 3 → 4 ---------- */

async function approveVisual() {
  if (!state.imageBlob) return toast('Visual ready nahi hai', true);

  // Render final screen
  $('#finalPost').textContent = state.post;
  $('#finalImage').src = state.imageUrl || '';
  $('#finalImage').style.display = state.imageUrl ? 'block' : 'none';

  // Chips
  const chips = [
    `<span class="chip">🎯 <strong>${TEMPLATES[state.goal]?.label || state.goal}</strong></span>`,
    `<span class="chip">${state.contentType === 'reel' ? '🎬 Reel' : '🖼️ Image Post'}</span>`,
    `<span class="chip">🏷 <strong>${state.brandName}</strong></span>`
  ];
  $('#finalChips').innerHTML = chips.join('');

  // Reel section
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
    // For reel, just regenerate cover image (script is usually fine on retry)
    showLoading('Naya cover image ban raha hai…');
    try {
      const blob = await geminiImage(state.imagePrompt, state.settings.geminiKey);
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

  showLoading('Naya image ban raha hai…', 'This may take 15–30 seconds');
  try {
    const blob = await geminiImage(state.imagePrompt, state.settings.geminiKey);
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

  showLoading('Feedback apply ho raha hai…', 'Refining the image prompt');
  try {
    const refinedPrompt = await geminiText(
      `You are an image prompt engineer. Take the current image prompt and the human feedback, and rewrite the prompt to reflect the feedback. Output ONLY the new prompt — no explanations, no quotes.`,
      `Current prompt:\n"""\n${state.imagePrompt}\n"""\n\nHuman feedback:\n"""\n${fb}\n"""`,
      state.settings.geminiKey
    );
    state.imagePrompt = refinedPrompt;
    $('#imagePromptDisplay').textContent = refinedPrompt;

    showLoading('Naya image ban raha hai…');
    const blob = await geminiImage(refinedPrompt, state.settings.geminiKey);
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
  L.push(`Duration: ${s.duration || '30s'}`);
  L.push('');
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
  const txt = state.post + '\n\n' + (state.contentType === 'reel' && state.reelScript
    ? '\n\n[Reel script attached — see download]'
    : '');
  navigator.clipboard
    .writeText(state.post)
    .then(() => toast('✓ Caption copied to clipboard'))
    .catch(() => toast('Copy fail — manually select karein', true));
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/* ---------- Reset ---------- */

function resetApp() {
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.post = '';
  state.postAttempts = 0;
  state.visualAttempts = 0;
  state.imagePrompt = '';
  state.imageBlob = null;
  state.imageUrl = null;
  state.reelScript = null;

  $('#brandForm').reset();
  $('#postText').value = '';
  $('#postFeedback').value = '';
  $('#visualFeedback').value = '';
  $('#previewImage').src = '';
  $('#previewImage').style.display = 'none';
  $('#reelScriptContainer').classList.add('hidden');
  $('#reelScript').innerHTML = '';
  $('#imagePromptDisplay').textContent = '';
  $('#postAttemptBadge').textContent = 'Attempt 1';
  $('#visualAttemptBadge').textContent = 'Attempt 1';

  showStep(1);
}

/* ---------- Init ---------- */

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  showStep(1);

  // Step 1 — brand form
  $('#brandForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#brandName').value.trim();
    const url = $('#brandUrl').value.trim();
    const goal = $('#goalTemplate').value;
    if (!name) return toast('Brand name required', true);
    if (!url) return toast('Website / page link required', true);
    if (!goal) return toast('Goal template select karein', true);
    if (!state.settings.geminiKey) return toast('Settings me Gemini API key daalein ⚙️', true);

    state.brandName = name;
    state.brandUrl = url;
    state.goal = goal;
    state.contentType = $('#contentType').value;
    state.brandContext = $('#brandContext').value.trim();
    state.extraNotes = $('#extraNotes').value.trim();

    generatePost();
  });

  // Step 2
  $('#approvePostBtn').addEventListener('click', approvePost);
  $('#newPostBtn').addEventListener('click', newPost);
  $('#revisePostBtn').addEventListener('click', revisePost);

  // Step 3
  $('#approveVisualBtn').addEventListener('click', approveVisual);
  $('#regenVisualBtn').addEventListener('click', regenerateVisual);
  $('#applyVisualFeedbackBtn').addEventListener('click', applyVisualFeedback);

  // Step 4
  $('#downloadImageBtn').addEventListener('click', downloadImage);
  $('#downloadCaptionBtn').addEventListener('click', downloadCaption);
  $('#downloadReelBtn').addEventListener('click', downloadReelScript);
  $('#copyCaptionBtn').addEventListener('click', copyCaption);
  $('#resetBtn').addEventListener('click', resetApp);

  // Settings
  $('#settingsToggle').addEventListener('click', () =>
    $('#settingsPanel').classList.add('open')
  );
  $('#settingsClose').addEventListener('click', () =>
    $('#settingsPanel').classList.remove('open')
  );
  ['geminiKey', 'textModel', 'imageModel'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveSettings);
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});