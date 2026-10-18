// Opt-in browser regression test. Requires Playwright and a running Next server.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright node --import tsx --test tests/study-room.browser.cjs
// Optional: STUDY_TEST_URL, STUDY_TEST_CHROME, STUDY_TEST_SCREENSHOT.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {useGame} = require('../src/store/game.ts');
const baseURL = process.env.STUDY_TEST_URL || 'http://127.0.0.1:3100';
const savedGame = JSON.stringify({state:{...useGame.getState(),created:true,tourDone:true,course:'python',studyTopic:'python',settings:{...useGame.getState().settings,motion:false}},version:0});
const session = {id:'browser-quiz',topic:'Root biology',difficulty:'Intermediate',quiz:{
 multiple_choice:Array.from({length:4},(_,i)=>({question:`Root question ${i+1}?`,A:'Absorb water',B:'Produce flowers',C:'Make seeds',D:'Attract bees',correct_answer:'A',explanation:'Roots absorb water.'})),
 short_answer:{question:'What do roots do?',correct_answer:'Absorb water.',explanation:'Roots take up water and minerals.',grading_criteria:'Water uptake.'},
}};
async function setup(browser,{authenticated=true,viewport={width:1440,height:960}}={}){
 const context=await browser.newContext({viewport});
 await context.addInitScript(({save,authenticated})=>{
  if(!localStorage.getItem('sproutbound-v1'))localStorage.setItem('sproutbound-v1',save);
  window.auth0={createAuth0Client(){}};
  window.SproutboundAuth={isConfigured:()=>true,initialize:async()=>authenticated?{sub:'test|study-ui',name:'Test gardener'}:null,login:async()=>({sub:'test|study-ui'}),signup:async()=>({sub:'test|study-ui'}),logout:async()=>{},loginInTab:async()=>{},errorMessage:()=> 'Sign-in failed.'};
 },{save:savedGame,authenticated});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseURL+'/learn',{waitUntil:'domcontentloaded'});
 return {context,page,errors};
}

test('questionnaire book UI, quiz, flashcards, history, stats and legacy courses work together',{timeout:90000},async()=>{
 console.log('Launching isolated browser');
 const browser=await chromium.launch({headless:true,timeout:20000,...(process.env.STUDY_TEST_CHROME?{executablePath:process.env.STUDY_TEST_CHROME}:{channel:'chrome'})});
 try{
  console.log('Opening production study room');
  const {context,page,errors}=await setup(browser);
  const requests=[];
  await page.route('**/api/study',async route=>{
   const data=route.request().postDataJSON();requests.push(data);
   const body=data.action==='generate'?session:data.action==='replay'?{...session,id:'browser-replay',rewardId:session.id}:{score:5,correct:[true,true,true,true,true],nutrients:100,coins:20};
   await route.fulfill({json:body});
  });
  await page.getByRole('button',{name:'Start studying',exact:true}).waitFor({state:'visible'});
  const surfaces=await page.locator('.cozy-study').evaluate(room=>{
   const style=selector=>getComputedStyle(room.querySelector(selector));
   const panel=room.querySelector('.study-paper').getBoundingClientRect();
   const button=room.querySelector('.topic-study form button').getBoundingClientRect();
   return {paperBorder:style('.study-paper').borderTopWidth,paperBackground:style('.study-paper').backgroundColor,cabinetBackground:style('.subject-cabinet').backgroundImage,topicFlex:style('.topic-study').flexGrow,buttonFits:button.bottom<=panel.bottom};
  });
  assert.equal(surfaces.paperBorder,'0px');
  assert.equal(surfaces.paperBackground,'rgba(0, 0, 0, 0)');
  assert.equal(surfaces.cabinetBackground,'none');
  assert.equal(surfaces.topicFlex,'1');assert.ok(surfaces.buttonFits);
  if(process.env.STUDY_TEST_SCREENSHOT)await page.screenshot({path:process.env.STUDY_TEST_SCREENSHOT,fullPage:true});
  await page.getByRole('button',{name:'Offline lessons',exact:true}).click();
  await page.getByRole('button',{name:'Explore another subject',exact:true}).click();
  await page.getByRole('button',{name:'Plant my learning journey',exact:false}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Topic quiz',exact:true}).click();
  await page.getByLabel('Learning topic',{exact:true}).fill('Root biology');
  await page.getByRole('combobox',{name:/Difficulty/}).selectOption('Intermediate');
  await page.getByRole('button',{name:'Start studying',exact:true}).click();
  await page.getByRole('heading',{name:'Question 1 of 5',exact:true}).waitFor();
  await page.getByRole('radio',{name:'A. Absorb water',exact:true}).check();
  await page.getByRole('button',{name:'Next question',exact:true}).click();
  await page.getByRole('button',{name:'Flashcards',exact:true}).click();
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await page.getByRole('combobox',{name:/Flashcard deck/}).selectOption('Math');
  await page.getByRole('combobox',{name:/Flashcard deck/}).selectOption('quiz');
  assert.match(await page.locator('.flash-copy').innerText(),/Root question 1/);
  await page.getByRole('button',{name:'My Desk',exact:true}).click();
  await page.getByRole('heading',{name:'Question 2 of 5',exact:true}).waitFor();
  for(let i=2;i<=4;i++){
   await page.getByRole('radio',{name:'A. Absorb water',exact:true}).check();
   await page.getByRole('button',{name:'Next question',exact:true}).click();
  }
  await page.getByLabel('Your answer (one or two sentences)',{exact:true}).fill('Roots absorb water.');
  await page.getByRole('button',{name:'Check my answers',exact:true}).click();
  await page.getByRole('heading',{name:'Your score: 5/5',exact:true}).waitFor();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sproutbound-v1')).state);
  assert.equal((await state()).energy,160);assert.equal((await state()).coins,20);assert.equal((await state()).course,'python');
  await page.getByRole('button',{name:'Stats',exact:true}).click();
  assert.match(await page.locator('.study-stats').innerText(),/Study coins\s+20/);
  assert.match(await page.locator('.most-studied-topics').innerText(),/Root biology/);
  await page.getByRole('dialog',{name:'Cozy study room',exact:true}).getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('switch',{name:'Focus session',exact:true}).uncheck();
  await page.locator('.focus-menu').waitFor({state:'hidden'});
  await page.getByRole('switch',{name:'Focus session',exact:true}).check();
  await page.getByRole('button',{name:/Expand focus timer/}).click();
  await page.getByRole('button',{name:'Start focus timer',exact:true}).click();
  await page.getByRole('button',{name:'Pause focus timer',exact:true}).click();
  await page.getByRole('button',{name:'Reset focus timer',exact:true}).click();
  await page.reload();
  await page.locator('.topic-history button').filter({hasText:'Root biology'}).click();
  await page.getByRole('heading',{name:'Your score: 5/5',exact:true}).waitFor();
  await page.getByRole('button',{name:'Answer this quiz again',exact:true}).click();
  for(let i=1;i<=4;i++){
   await page.getByRole('radio',{name:'A. Absorb water',exact:true}).check();
   await page.getByRole('button',{name:'Next question',exact:true}).click();
  }
  await page.getByLabel('Your answer (one or two sentences)',{exact:true}).fill('Absorb water.');
  await page.getByRole('button',{name:'Check my answers',exact:true}).click();
  await page.getByRole('heading',{name:'Your score: 5/5',exact:true}).waitFor();
  assert.equal((await state()).energy,160);assert.equal((await state()).coins,20);
  assert.deepEqual(requests.map(r=>r.action),['generate','grade','replay','grade']);
  assert.deepEqual(errors,[]);
  await context.close();
  const mobile=await setup(browser,{viewport:{width:390,height:844}});
  await mobile.page.getByRole('button',{name:'Start studying',exact:true}).waitFor({state:'visible'});
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(mobile.errors,[]);
  await mobile.context.close();
  const signedOut=await setup(browser,{authenticated:false});
  await signedOut.page.getByRole('button',{name:'Enter the Greenhouse',exact:true}).waitFor();
  assert.equal(await signedOut.page.locator('.cozy-study').count(),0);
  await signedOut.context.close();
 }finally{await browser.close();}
});
