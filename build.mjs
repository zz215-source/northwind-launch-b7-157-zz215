import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
const plan = JSON.parse(await readFile('launch-plan.json', 'utf8'));
const expected = plan.approved_production;
const e = process.env;
const secretCheck = key => ({ present: Boolean(e[key]), matches_approved_value: Boolean(e[key]) && e[key] === expected[key] });
const checks = {
  production_context: e.CONTEXT === 'production',
  backend_matches: e.API_BASE_URL === expected.API_BASE_URL,
  release_channel_matches: e.RELEASE_CHANNEL === expected.RELEASE_CHANNEL,
  api_token: secretCheck('LAUNCH_API_TOKEN'),
  webhook_secret: secretCheck('WEBHOOK_SIGNING_SECRET'),
  log_level_preserved: e.LOG_LEVEL === 'info'
};
const ready = checks.production_context && checks.backend_matches && checks.release_channel_matches && checks.api_token.matches_approved_value && checks.webhook_secret.matches_approved_value && checks.log_level_preserved;
const status = { task: 'B7-157', synthetic: true, captured_at_build: new Date().toISOString(), deploy_id: e.DEPLOY_ID || 'local-validation', context: e.CONTEXT || 'local', commit: e.COMMIT_REF || null, public_settings: { API_BASE_URL: e.API_BASE_URL || null, RELEASE_CHANNEL: e.RELEASE_CHANNEL || null, LOG_LEVEL: e.LOG_LEVEL || null }, checks, launch_ready: ready };
await mkdir('dist', { recursive: true });
await writeFile('dist/status.json', JSON.stringify(status, null, 2));
await copyFile('launch-plan.json', 'dist/launch-plan.json');
const esc = s => String(s ?? 'Missing').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows = [['Backend URL', e.API_BASE_URL, checks.backend_matches], ['Release channel', e.RELEASE_CHANNEL, checks.release_channel_matches], ['API token', checks.api_token.present ? 'Present; value hidden' : 'Missing', checks.api_token.matches_approved_value], ['Webhook secret', checks.webhook_secret.present ? 'Present; value hidden' : 'Missing', checks.webhook_secret.matches_approved_value], ['Log level', e.LOG_LEVEL, checks.log_level_preserved]];
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Northwind launch readiness | B7-157</title><style>body{font:17px system-ui;background:#f4f6fa;color:#14253e;max-width:1000px;margin:50px auto;padding:24px}main{background:white;padding:32px;border-radius:14px}small{color:#547084}h1{margin-bottom:8px}.status{padding:16px;background:${ready?'#def5e7':'#fff0d2'};font-weight:bold;border-radius:8px}table{border-collapse:collapse;width:100%;margin:24px 0}td,th{text-align:left;padding:14px 8px;border-bottom:1px solid #dfe6ee}code{font-size:14px;overflow-wrap:anywhere}a{color:#185da3}footer{font-size:14px;margin-top:20px}</style><main><small>SYNTHETIC BENCHMARK · B7-157</small><h1>Northwind launch readiness</h1><p>Production configuration captured by the hosted build.</p><div class="status">${ready?'Ready for launch':'Not ready for launch'}</div><table><thead><tr><th>Setting</th><th>Build-time value</th><th>Approved check</th></tr></thead><tbody>${rows.map(([k,v,ok])=>`<tr><td>${esc(k)}</td><td><code>${esc(v)}</code></td><td>${ok?'PASS':'FAIL'}</td></tr>`).join('')}</tbody></table><p>Context: <b>${esc(status.context)}</b><br>Deploy: <code>${esc(status.deploy_id)}</code><br>Built: <code>${esc(status.captured_at_build)}</code></p><p><a href="/launch-plan.json">Approved launch plan</a> · <a href="/status.json">Verification JSON</a></p><footer>Fictional configuration only. No working credentials, external API calls, customer records or payments. Environment changes take effect here only after a fresh build.</footer></main></html>`;
await writeFile('dist/index.html', html);
console.log(`B7-157 configuration captured; context=${status.context}; launch_ready=${ready}; secret values omitted.`);
