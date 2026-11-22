import {expect,test} from '@playwright/test';
import {createEnterpriseSession} from '../demo/enterpriseSession';
test('delayed SDK logout never revokes the next enterprise user',async()=>{
 let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});let count=0;const revoked:string[]=[];
 const native={prepareLogin:async()=>({attemptId:'attempt',installationId:'installation',platform:'web',applicationId:'https://app.example',pushEnvironment:'default',codeChallenge:'challenge',codeChallengeMethod:'S256'}),loginWithTicket:async()=>{},logout:()=>pending};
 const transport=async(url:any,options:any)=>{
  if(String(url).endsWith('/logout'))revoked.push(options.headers.Authorization);
  const data=String(url).endsWith('/login')?{enterprise_access_token:`host-${++count}`}:{attempt_id:'attempt',login_ticket:'ticket'};
  return new Response(JSON.stringify(data),{status:200});
 };
 const host=createEnterpriseSession('https://host.example',native as any,transport as any);
 await host.login('A','password');const old=host.logout();await host.login('B','password');release();await old;
 expect(revoked).toEqual(['Bearer host-1','Bearer host-1']);await host.retryLogout();expect(revoked.at(-1)).toBe('Bearer host-2');
});
