import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const duration=Number(process.env.EDITOR_PROFILE_MS || 35000);
const results=[];
try {
  for(const count of [23,1000,5000]) {
    const context=await browser.newContext({viewport:{width:390,height:844}});
    const page=await context.newPage();
    // Keep the development HMR channel local to this test. Build/watch reloads must not reset samples.
    await page.routeWebSocket(url => url.host === new URL(process.env.EDITOR_TEST_URL || 'http://127.0.0.1:5174').host, ws => {
      ws.send(JSON.stringify({type:'connected'}));
    });
    await page.goto(`${process.env.EDITOR_TEST_URL || 'http://127.0.0.1:5174'}/tests/editorHarness.html?count=${count}`);
    await page.locator('canvas').waitFor();
    const measure = () => page.evaluate(ms=>new Promise(resolve=>{
      const frames=[];const tasks=[];let last=performance.now();const until=last+ms;
      const observer=new PerformanceObserver(list=>list.getEntries().forEach(e=>tasks.push(e.duration)));
      observer.observe({type:'longtask',buffered:false});
      function next(now){frames.push(now-last);last=now;if(now<until)requestAnimationFrame(next);else{observer.disconnect();frames.sort((a,b)=>a-b);resolve({durationMs:ms,frames:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],longTasks:tasks.length,maxLongTask:Math.max(0,...tasks)});}}
      requestAnimationFrame(next);
    }),duration);
    const idle=await measure();
    await page.getByRole('button',{name:'Putar / Jeda Audio (Spasi)',exact:true}).click();
    const playback=await measure();
    results.push({count,idle,playback});console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
}finally{await browser.close();await fs.writeFile(process.env.EDITOR_PROFILE_OUTPUT || 'docs/editor-performance.json',JSON.stringify({environment:'Edge Chromium headless, 390x844, development build, test HMR channel mocked against watcher reloads, this Windows host; not physical devices',threshold:'frame p95 <= 33.4ms (30fps); investigate long tasks >=50ms',results},null,2));}
