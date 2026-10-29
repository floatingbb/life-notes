import assert from 'node:assert/strict';
import {cloudConfig} from '../src/cloud-config.mjs';
assert.throws(()=>cloudConfig({}),/CLOUDBASE_ENV_ID/);
assert.throws(()=>cloudConfig({CLOUDBASE_ENV_ID:'YOUR_NEW_ENV_ID'}),/CLOUDBASE_ENV_ID/);
assert.throws(()=>cloudConfig({CLOUDBASE_ENV_ID:'isolated-test-env',CLOUDBASE_REGION:'bad'}),/REGION/);
// String validation only; this synthetic origin is never requested.
const env={CLOUDBASE_ENV_ID:'isolated-test-env',CLOUDBASE_REGION:'ap-shanghai',CLOUDBASE_APIKEY:'synthetic-test-key-'.repeat(4),SESSION_SECRET:'synthetic-test-session-'.repeat(4),BOOTSTRAP_TOKEN:'0'.repeat(64),SITE_ORIGIN:'https://journal.unit-check.dev'};
assert.deepEqual(cloudConfig(env),{envId:'isolated-test-env',region:'ap-shanghai',photoBucket:'our-days-photos',siteOrigin:'https://journal.unit-check.dev'});
assert.throws(()=>cloudConfig({...env,PHOTO_BUCKET:'../wrong'}),/PHOTO_BUCKET/);
assert.throws(()=>cloudConfig({...env,SESSION_SECRET:''}),/SESSION_SECRET/);
assert.throws(()=>cloudConfig({...env,BOOTSTRAP_TOKEN:''}),/BOOTSTRAP_TOKEN/);
for(const value of ['', 'https://your-site.example', 'https://example.com', 'https://demo.example.org', 'https://days.test', 'https://site.invalid', 'http://journal.unit-check.dev', 'https://journal.unit-check.dev/path', 'https://journal.unit-check.dev/#setup=placeholder', 'https://user:password@journal.unit-check.dev'])assert.throws(()=>cloudConfig({...env,SITE_ORIGIN:value}),/SITE_ORIGIN/);
assert.equal(cloudConfig({...env,SITE_ORIGIN:'https://journal.unit-check.dev:443/'}).siteOrigin,'https://journal.unit-check.dev');
console.log('PASS: explicit administrator-owned origin, rejected placeholders and address credentials, independent environment, and newly generated bootstrap configuration required.');
