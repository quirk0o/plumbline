import { chromium } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL = 'test@example.com';
const TEST_IMAGE = '/Users/beatka/Projects/simstrack-526/.claude/worktrees/feat+legacy-creation-wizard/public/uploads/1778220455753-Lemons.png';
const SCREENSHOT_DIR = '/Users/beatka/Projects/simstrack-526/.claude/worktrees/feat+legacy-creation-wizard/qa-screenshots';

import fs from 'fs';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// ─── SIGN IN ─────────────────────────────────────────────────────────────────
console.log('\n=== SIGN IN ===');
await page.goto(`${BASE_URL}/auth/signin`);
await page.screenshot({ path: `${SCREENSHOT_DIR}/00-signin-page.png` });
console.log('Navigated to sign-in page');

// Fill email and submit
const emailInput = page.locator('input[type="email"]');
await emailInput.fill(TEST_EMAIL);
await page.screenshot({ path: `${SCREENSHOT_DIR}/01-email-filled.png` });

const submitButton = page.locator('button[type="submit"]');
await submitButton.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SCREENSHOT_DIR}/02-after-submit.png` });
console.log('Submitted magic link request');

// Get magic link from server log
import { execSync } from 'child_process';
let magicLink = null;
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    const logOutput = execSync(
      'grep "Magic link" /Users/beatka/Projects/simstrack-526/.claude/worktrees/feat+legacy-creation-wizard/.next/dev/logs/next-development.log | tail -3',
      { encoding: 'utf8' }
    );
    console.log('Log output:', logOutput);
    const match = logOutput.match(/http:\/\/localhost:3001\/api\/auth\/callback\/email[^\s'"]+/);
    if (match) {
      magicLink = match[0];
      break;
    }
  } catch (e) {
    console.log(`Attempt ${attempt + 1} failed:`, e.message);
  }
  await page.waitForTimeout(1000);
}

if (!magicLink) {
  // Try alternate pattern
  try {
    const logOutput = execSync(
      'grep -i "magic" /Users/beatka/Projects/simstrack-526/.claude/worktrees/feat+legacy-creation-wizard/.next/dev/logs/next-development.log | tail -5',
      { encoding: 'utf8' }
    );
    console.log('Alternate log search:', logOutput);
    const match = logOutput.match(/http:\/\/localhost:300[01]\/api\/auth\/callback\/email[^\s'"]+/);
    if (match) {
      magicLink = match[0];
    }
  } catch (e) {
    console.log('Alternate search failed:', e.message);
  }
}

if (!magicLink) {
  console.error('ERROR: Could not find magic link in logs');
  await browser.close();
  process.exit(1);
}

console.log('Found magic link:', magicLink.substring(0, 80) + '...');

// Navigate to callback URL
await page.goto(magicLink);
await page.waitForTimeout(3000);
const afterAuthUrl = page.url();
console.log('URL after auth:', afterAuthUrl);
await page.screenshot({ path: `${SCREENSHOT_DIR}/03-after-auth.png` });

if (afterAuthUrl.includes('/auth/signin') || afterAuthUrl.includes('/auth/error')) {
  console.error('ERROR: Auth failed, still on auth page');
  await browser.close();
  process.exit(1);
}
console.log('Authentication successful');

// ─── NAVIGATE TO /app/legacies/new ───────────────────────────────────────────
console.log('\n=== NAVIGATING TO /app/legacies/new ===');
await page.goto(`${BASE_URL}/app/legacies/new`);
await page.waitForTimeout(2000);
const currentUrl = page.url();
console.log('Current URL:', currentUrl);
await page.screenshot({ path: `${SCREENSHOT_DIR}/04-legacies-new.png` });

// ─── TEST 1: BEFORE UPLOAD ────────────────────────────────────────────────────
console.log('\n=== TEST 1: BEFORE UPLOAD ===');

// Look for the upload button with dashed border / "Cover image" text
const uploadButtonSelectors = [
  'button[style*="border"]',
  'button.dashed',
  '[data-testid="cover-image"]',
  'button:has-text("Cover image")',
  'label:has-text("Cover image")',
  '[aria-label*="cover"]',
  '[aria-label*="Cover"]',
];

let uploadBtn = null;
let uploadBtnSelector = null;
for (const sel of uploadButtonSelectors) {
  try {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 })) {
      uploadBtn = el;
      uploadBtnSelector = sel;
      console.log(`Found upload element with selector: ${sel}`);
      break;
    }
  } catch (e) {
    // continue
  }
}

// If no button found, try to dump all buttons for inspection
if (!uploadBtn) {
  const allButtons = await page.$$('button');
  console.log(`Total buttons on page: ${allButtons.length}`);
  for (const btn of allButtons) {
    const text = await btn.innerText().catch(() => '');
    const style = await btn.getAttribute('style').catch(() => '');
    const className = await btn.getAttribute('class').catch(() => '');
    console.log(`  Button: text="${text}" style="${style}" class="${className}"`);
  }

  // Also check labels
  const allLabels = await page.$$('label');
  console.log(`Total labels on page: ${allLabels.length}`);
  for (const lbl of allLabels) {
    const text = await lbl.innerText().catch(() => '');
    const style = await lbl.getAttribute('style').catch(() => '');
    const className = await lbl.getAttribute('class').catch(() => '');
    console.log(`  Label: text="${text}" style="${style}" class="${className}"`);
  }
}

if (uploadBtn) {
  const box = await uploadBtn.boundingBox();
  const text = await uploadBtn.innerText().catch(() => 'N/A');
  const style = await uploadBtn.getAttribute('style').catch(() => '');
  const className = await uploadBtn.getAttribute('class').catch(() => '');

  console.log('TEST 1 RESULTS:');
  console.log(`  Text: "${text}"`);
  console.log(`  Style: "${style}"`);
  console.log(`  Class: "${className}"`);
  console.log(`  Bounding box: ${JSON.stringify(box)}`);

  const widthOk = box && Math.abs(box.width - 104) <= 10;
  const heightOk = box && Math.abs(box.height - 104) <= 10;
  const textOk = text.toLowerCase().includes('cover image') || text.toLowerCase().includes('cover');

  console.log(`  Width ~104px: ${widthOk ? 'PASS' : 'FAIL'} (actual: ${box?.width})`);
  console.log(`  Height ~104px: ${heightOk ? 'PASS' : 'FAIL'} (actual: ${box?.height})`);
  console.log(`  Contains "Cover image" text: ${textOk ? 'PASS' : 'FAIL'}`);
} else {
  console.log('TEST 1: FAIL — Could not find upload button');
}

// ─── TEST 2: AFTER UPLOAD ─────────────────────────────────────────────────────
console.log('\n=== TEST 2: AFTER UPLOAD ===');

const fileInput = page.locator('input[type="file"][accept="image/*"]');
const fileInputVisible = await fileInput.count();
console.log(`File inputs with accept="image/*": ${fileInputVisible}`);

if (fileInputVisible > 0) {
  await fileInput.setInputFiles(TEST_IMAGE);
  console.log('File set, waiting for background-image...');

  // Wait for background-image to appear on the upload button
  let bgImageFound = false;
  let targetEl = uploadBtn;

  // Wait up to 10s for background-image to appear
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);

    // Check all possible target elements
    const candidates = [
      uploadBtn,
      page.locator('button').filter({ hasText: '' }).first(),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const style = await candidate.getAttribute('style').catch(() => '');
        const computedBg = await candidate.evaluate(el =>
          window.getComputedStyle(el).backgroundImage
        ).catch(() => '');

        if (style?.includes('background-image') || (computedBg && computedBg !== 'none')) {
          bgImageFound = true;
          targetEl = candidate;
          console.log(`Background image found after ${(i+1)*0.5}s`);
          console.log(`  Style attr: "${style}"`);
          console.log(`  Computed bg: "${computedBg}"`);
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (bgImageFound) break;

    // Also check parent elements of file input
    const bgFromParents = await page.evaluate(() => {
      const allEls = document.querySelectorAll('*');
      const results = [];
      for (const el of allEls) {
        const style = el.getAttribute('style') || '';
        const computed = window.getComputedStyle(el).backgroundImage;
        if (style.includes('background-image') || (computed && computed !== 'none')) {
          results.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            styleAttr: style,
            computedBg: computed,
          });
        }
      }
      return results;
    });

    if (bgFromParents.length > 0) {
      console.log('Elements with background-image:', JSON.stringify(bgFromParents, null, 2));
      bgImageFound = true;
      break;
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-after-upload.png` });

  if (!bgImageFound) {
    console.log('TEST 2: WARNING — background-image not found after 10s, checking current state');
  }

  // Get final state of upload button area
  if (uploadBtn) {
    const styleAttr = await uploadBtn.getAttribute('style').catch(() => '');
    const bgImage = await uploadBtn.evaluate(el => window.getComputedStyle(el).backgroundImage).catch(() => 'N/A');
    const bgSize = await uploadBtn.evaluate(el => window.getComputedStyle(el).backgroundSize).catch(() => 'N/A');
    const bgPos = await uploadBtn.evaluate(el => window.getComputedStyle(el).backgroundPosition).catch(() => 'N/A');
    const box = await uploadBtn.boundingBox();

    console.log('TEST 2 RESULTS (upload button):');
    console.log(`  Style attr: "${styleAttr}"`);
    console.log(`  Computed background-image: "${bgImage}"`);
    console.log(`  Computed background-size: "${bgSize}"`);
    console.log(`  Computed background-position: "${bgPos}"`);
    console.log(`  Bounding box: ${JSON.stringify(box)}`);

    const hasBgImage = styleAttr?.includes('background-image') || (bgImage && bgImage !== 'none');
    const bgSizeOk = bgSize === 'cover';
    const bgPosOk = bgPos === '50% 50%' || bgPos?.includes('center') || bgPos === 'center center';
    const widthOk = box && Math.abs(box.width - 104) <= 10;
    const heightOk = box && Math.abs(box.height - 104) <= 10;

    console.log(`  Has background-image: ${hasBgImage ? 'PASS' : 'FAIL'}`);
    console.log(`  background-size is cover: ${bgSizeOk ? 'PASS' : 'FAIL'} (actual: "${bgSize}")`);
    console.log(`  background-position is center: ${bgPosOk ? 'PASS' : 'FAIL'} (actual: "${bgPos}")`);
    console.log(`  Width still ~104px: ${widthOk ? 'PASS' : 'FAIL'} (actual: ${box?.width})`);
    console.log(`  Height still ~104px: ${heightOk ? 'PASS' : 'FAIL'} (actual: ${box?.height})`);
  }
} else {
  console.log('TEST 2: FAIL — No file input with accept="image/*" found');
  // List all file inputs
  const allFileInputs = await page.$$('input[type="file"]');
  console.log(`Total file inputs: ${allFileInputs.length}`);
  for (const fi of allFileInputs) {
    const accept = await fi.getAttribute('accept').catch(() => '');
    const name = await fi.getAttribute('name').catch(() => '');
    console.log(`  File input: accept="${accept}" name="${name}"`);
  }
}

// ─── TEST 3: HOVER STATE ──────────────────────────────────────────────────────
console.log('\n=== TEST 3: HOVER STATE ===');

if (uploadBtn) {
  await uploadBtn.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-hover-state.png` });

  const bgSizeOnHover = await uploadBtn.evaluate(el => window.getComputedStyle(el).backgroundSize).catch(() => 'N/A');
  const bgImageOnHover = await uploadBtn.evaluate(el => window.getComputedStyle(el).backgroundImage).catch(() => 'N/A');
  const bgPosOnHover = await uploadBtn.evaluate(el => window.getComputedStyle(el).backgroundPosition).catch(() => 'N/A');

  console.log('TEST 3 RESULTS:');
  console.log(`  Computed background-size on hover: "${bgSizeOnHover}"`);
  console.log(`  Computed background-image on hover: "${bgImageOnHover}"`);
  console.log(`  Computed background-position on hover: "${bgPosOnHover}"`);

  const bgSizeOk = bgSizeOnHover === 'cover';
  console.log(`  background-size is still cover: ${bgSizeOk ? 'PASS' : 'FAIL'} (actual: "${bgSizeOnHover}")`);
}

console.log('\n=== ALL TESTS COMPLETE ===');
console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

await browser.close();
