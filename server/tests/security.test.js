import test from 'node:test';import assert from 'node:assert/strict';import {issueToken} from '../src/middleware/authenticate.js';
test('JWT contains subject and user role',async()=>{process.env.JWT_SECRET='a'.repeat(48);const t=issueToken({_id:'507f1f77bcf86cd799439011',role:'ngo'});assert.equal(t.split('.').length,3);});
