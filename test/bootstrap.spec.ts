import { expect, test } from '@playwright/test';
import { requestLoginTicket } from '../demo/hostBackend';
const preparation = { attemptId:'11111111-1111-4111-8111-111111111111',installationId:'22222222-2222-4222-8222-222222222222',platform:'web' as const,applicationId:'https://app.example.com',pushEnvironment:'default' as const,codeChallenge:'c'.repeat(43),codeChallengeMethod:'S256' as const };
const ticket = {attempt_id:preparation.attemptId,login_ticket:'t'.repeat(43),expires_at:'2099-01-01T00:00:00Z'};
test('bootstrap uses existing same-origin session and only public preparation fields',async()=>{
 let actualUrl:unknown;let actual:RequestInit|undefined;
 const transport:typeof fetch=async(url,init)=>{actualUrl=url;actual=init;return new Response(JSON.stringify(ticket));};
 const result=await requestLoginTicket({...preparation,user_id:'999',api_token:'must-not-be-forwarded'} as any,transport,'current-csrf-token');
 expect(result).toEqual(ticket);expect(actualUrl).toBe('/api/voice/bootstrap');
 expect(actual?.credentials).toBe('same-origin');expect(actual?.redirect).toBe('error');expect(actual?.cache).toBe('no-store');
 const headers=new Headers(actual?.headers);expect(headers.get('X-CSRF-Token')).toBe('current-csrf-token');expect(headers.has('Authorization')).toBe(false);
 expect(JSON.parse(String(actual?.body))).toEqual({attempt_id:preparation.attemptId,installation_id:preparation.installationId,os:'web',application_id:preparation.applicationId,push_environment:'default',code_challenge:preparation.codeChallenge,code_challenge_method:'S256'});
});
test('bootstrap requires application login when its session expires',async()=>{
 const transport:typeof fetch=async()=>new Response('{}',{status:401});
 await expect(requestLoginTicket(preparation,transport)).rejects.toMatchObject({code:'HOST_LOGIN_REQUIRED'});
});
test('bootstrap rejects mismatched attempts and malformed tickets',async()=>{
 for(const value of [null,{}, {...ticket,attempt_id:'another-attempt'}, {...ticket,login_ticket:''},{...ticket,expires_at:'invalid'},{...ticket,expires_at:2026}]) {
  const transport:typeof fetch=async()=>new Response(JSON.stringify(value));
  await expect(requestLoginTicket(preparation,transport)).rejects.toMatchObject({code:'INVALID_BOOTSTRAP_RESPONSE'});
 }
});
test('bootstrap sanitizes failures and never falls back to a demo login',async()=>{
 let count=0;
 const transport:typeof fetch=async()=>{count++;return new Response('{"secret":"provider-detail"}',{status:503});};
 await expect(requestLoginTicket(preparation,transport)).rejects.toMatchObject({code:'BOOTSTRAP_REQUEST_FAILED',status:503});
 expect(count).toBe(1);
 const offline:typeof fetch=async()=>{throw new Error('sensitive provider detail');};
 await expect(requestLoginTicket(preparation,offline)).rejects.toMatchObject({code:'BOOTSTRAP_REQUEST_FAILED'});
});
