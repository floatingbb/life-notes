import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../package.json',import.meta.url)),ts=require('typescript');
async function load(file){const js=ts.transpileModule(readFileSync('src/'+file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))}
const {cropGeometry,CROP_DIAMETER}=await load('avatar-crop.ts'),{swipeDirection,slideIndex}=await load('gallery.ts');
const square=cropGeometry(1000,1000,1,{x:0,y:0});assert.equal(square.sx,0);assert.equal(square.sy,0);assert.equal(square.edge,1000);
const landscape=cropGeometry(1200,600,1,{x:0,y:0});assert.equal(landscape.sx,300);assert.equal(landscape.sy,0);assert.equal(landscape.edge,600);
const portrait=cropGeometry(600,1200,1,{x:0,y:0});assert.equal(portrait.sx,0);assert.equal(portrait.sy,300);
for(const [w,h]of [[4032,3024],[3024,4032],[1,2000],[2000,1],[160,160],[50,80]])for(const zoom of [1,1.01,2,4])for(const x of [-100000,-53,0,53,100000])for(const y of [-100000,-53,0,53,100000]){
 const g=cropGeometry(w,h,zoom,{x,y});assert.ok(g.sx>=0&&g.sy>=0);assert.ok(g.sx+g.edge<=w+1e-8&&g.sy+g.edge<=h+1e-8,'Crop never exceeds source image');assert.ok(g.width>=CROP_DIAMETER-1e-8&&g.height>=CROP_DIAMETER-1e-8);
 const left=160+g.x-g.width/2,top=160+g.y-g.height/2;
 assert.ok(Math.abs((32-left)/g.scale-g.sx)<1e-8,'Saved crop aligns with circular preview left edge');assert.ok(Math.abs((32-top)/g.scale-g.sy)<1e-8,'Saved crop aligns with circular preview top edge');
}
assert.throws(()=>cropGeometry(0,10,1,{x:0,y:0}),/尺寸/);
assert.equal(swipeDirection(-90,12),1);assert.equal(swipeDirection(90,-12),-1);assert.equal(swipeDirection(30,0),0);assert.equal(swipeDirection(50,90),0);assert.equal(swipeDirection(0,90),0);
assert.equal(slideIndex(1,1,3),2);assert.equal(slideIndex(1,-1,3),0);assert.equal(slideIndex(0,-1,3),0);assert.equal(slideIndex(2,1,3),2);assert.equal(slideIndex(0,1,1),0);
const diary=readFileSync('src/diary.tsx','utf8');assert.ok(diary.includes('openPhotos(p.images,i)'));assert.ok(diary.includes('AvatarCropper'));assert.ok(!diary.includes('{lightbox&&'));
console.log('PASS: square/portrait/landscape circle crop alignment, zoom and drag boundaries, swipe direction vs vertical movement, selected-photo start, and gallery edge handling.');
