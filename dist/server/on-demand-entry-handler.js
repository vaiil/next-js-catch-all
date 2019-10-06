"use strict";exports.__esModule=true;exports.default=onDemandEntryHandler;exports.normalizePage=normalizePage;var _events=require("events");var _path=require("path");var _querystring=require("querystring");var _url=require("url");var _DynamicEntryPlugin=_interopRequireDefault(require("webpack/lib/DynamicEntryPlugin"));var _isWriteable=require("../build/is-writeable");var Log=_interopRequireWildcard(require("../build/output/log"));var _constants=require("../lib/constants");var _constants2=require("../next-server/lib/constants");var _normalizePagePath=require("../next-server/server/normalize-page-path");var _require=require("../next-server/server/require");var _findPageFile=require("./lib/find-page-file");function _interopRequireWildcard(obj){if(obj&&obj.__esModule){return obj;}else{var newObj={};if(obj!=null){for(var key in obj){if(Object.prototype.hasOwnProperty.call(obj,key)){var desc=Object.defineProperty&&Object.getOwnPropertyDescriptor?Object.getOwnPropertyDescriptor(obj,key):{};if(desc.get||desc.set){Object.defineProperty(newObj,key,desc);}else{newObj[key]=obj[key];}}}}newObj.default=obj;return newObj;}}function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}const ADDED=Symbol('added');const BUILDING=Symbol('building');const BUILT=Symbol('built');// Based on https://github.com/webpack/webpack/blob/master/lib/DynamicEntryPlugin.js#L29-L37
function addEntry(compilation,context,name,entry){return new Promise((resolve,reject)=>{const dep=_DynamicEntryPlugin.default.createDependency(entry,name);compilation.addEntry(context,dep,name,err=>{if(err)return reject(err);resolve();});});}function onDemandEntryHandler(devMiddleware,multiCompiler,{buildId,pagesDir,reload,pageExtensions,maxInactiveAge,pagesBufferLength}){const{compilers}=multiCompiler;const invalidator=new Invalidator(devMiddleware,multiCompiler);let entries={};let lastAccessPages=[''];let doneCallbacks=new _events.EventEmitter();let reloading=false;let stopped=false;let reloadCallbacks=new _events.EventEmitter();let lastEntry=null;for(const compiler of compilers){compiler.hooks.make.tapPromise('NextJsOnDemandEntries',compilation=>{invalidator.startBuilding();const allEntries=Object.keys(entries).map(async page=>{if(compiler.name==='client'&&page.match(_constants.API_ROUTE)){return;}const{name,absolutePagePath}=entries[page];const pageExists=await(0,_isWriteable.isWriteable)(absolutePagePath);if(!pageExists){Log.event('page was removed',page);delete entries[page];return;}entries[page].status=BUILDING;return addEntry(compilation,compiler.context,name,[compiler.name==='client'?`next-client-pages-loader?${(0,_querystring.stringify)({page,absolutePagePath})}!`:absolutePagePath]);});return Promise.all(allEntries).catch(err=>console.error(err));});}function findHardFailedPages(errors){return errors.filter(e=>{// Make sure to only pick errors which marked with missing modules
const hasNoModuleFoundError=/ENOENT/.test(e.message)||/Module not found/.test(e.message);if(!hasNoModuleFoundError)return false;// The page itself is missing. So this is a failed page.
if(_constants2.IS_BUNDLED_PAGE_REGEX.test(e.module.name))return true;// No dependencies means this is a top level page.
// So this is a failed page.
return e.module.dependencies.length===0;}).map(e=>e.module.chunks).reduce((a,b)=>[...a,...b],[]).map(c=>{const pageName=_constants2.ROUTE_NAME_REGEX.exec(c.name)[1];return normalizePage(`/${pageName}`);});}function getPagePathsFromEntrypoints(entrypoints){const pagePaths=[];for(const[,entrypoint]of entrypoints.entries()){const result=_constants2.ROUTE_NAME_REGEX.exec(entrypoint.name);if(!result){continue;}const pagePath=result[1];if(!pagePath){continue;}pagePaths.push(pagePath);}return pagePaths;}multiCompiler.hooks.done.tap('NextJsOnDemandEntries',multiStats=>{const[clientStats,serverStats]=multiStats.stats;const hardFailedPages=[...new Set([...findHardFailedPages(clientStats.compilation.errors),...findHardFailedPages(serverStats.compilation.errors)])];const pagePaths=new Set([...getPagePathsFromEntrypoints(clientStats.compilation.entrypoints),...getPagePathsFromEntrypoints(serverStats.compilation.entrypoints)]);// compilation.entrypoints is a Map object, so iterating over it 0 is the key and 1 is the value
for(const pagePath of pagePaths){const page=normalizePage('/'+pagePath);const entry=entries[page];if(!entry){continue;}if(entry.status!==BUILDING){continue;}entry.status=BUILT;entry.lastActiveTime=Date.now();doneCallbacks.emit(page);}invalidator.doneBuilding();if(hardFailedPages.length>0&&!reloading){console.log(`> Reloading webpack due to inconsistant state of pages(s): ${hardFailedPages.join(', ')}`);reloading=true;reload().then(()=>{console.log('> Webpack reloaded.');reloadCallbacks.emit('done');stop();}).catch(err=>{console.error(`> Webpack reloading failed: ${err.message}`);console.error(err.stack);process.exit(1);});}});const disposeHandler=setInterval(function(){if(stopped)return;disposeInactiveEntries(devMiddleware,entries,lastAccessPages,maxInactiveAge);},5000);disposeHandler.unref();function stop(){clearInterval(disposeHandler);stopped=true;doneCallbacks=null;reloadCallbacks=null;}function handlePing(pg){const page=normalizePage(pg);const entryInfo=entries[page];let toSend;// If there's no entry, it may have been invalidated and needs to be re-built.
if(!entryInfo){if(page!==lastEntry){Log.event(`client pings, but there's no entry for page: ${page}`);}lastEntry=page;return{invalid:true};}// 404 is an on demand entry but when a new page is added we have to refresh the page
if(page==='/_error'){toSend={invalid:true};}else{toSend={success:true};}// We don't need to maintain active state of anything other than BUILT entries
if(entryInfo.status!==BUILT)return;// If there's an entryInfo
if(!lastAccessPages.includes(page)){lastAccessPages.unshift(page);// Maintain the buffer max length
if(lastAccessPages.length>pagesBufferLength){lastAccessPages.pop();}}entryInfo.lastActiveTime=Date.now();return toSend;}return{waitUntilReloaded(){if(!reloading)return Promise.resolve(true);return new Promise(resolve=>{reloadCallbacks.once('done',function(){resolve();});});},async ensurePage(page){await this.waitUntilReloaded();let normalizedPagePath;try{normalizedPagePath=(0,_normalizePagePath.normalizePagePath)(page);}catch(err){console.error(err);throw(0,_require.pageNotFoundError)(page);}let pagePath=await(0,_findPageFile.findPageFile)(pagesDir,normalizedPagePath,pageExtensions);// Default the /_error route to the Next.js provided default page
if(page==='/_error'&&pagePath===null){pagePath='next/dist/pages/_error';}if(pagePath===null){throw(0,_require.pageNotFoundError)(normalizedPagePath);}let pageUrl=`/${pagePath.replace(new RegExp(`\\.+(?:${pageExtensions.join('|')})$`),'').replace(/\\/g,'/')}`.replace(/\/index$/,'');pageUrl=pageUrl===''?'/':pageUrl;const bundleFile=pageUrl==='/'?'/index.js':`${pageUrl}.js`;const name=(0,_path.join)('static',buildId,'pages',bundleFile);const absolutePagePath=pagePath.startsWith('next/dist/pages')?require.resolve(pagePath):(0,_path.join)(pagesDir,pagePath);page=_path.posix.normalize(pageUrl);return new Promise((resolve,reject)=>{// Makes sure the page that is being kept in on-demand-entries matches the webpack output
const normalizedPage=normalizePage(page);const entryInfo=entries[normalizedPage];if(entryInfo){if(entryInfo.status===BUILT){resolve();return;}if(entryInfo.status===BUILDING){doneCallbacks.once(normalizedPage,handleCallback);return;}}Log.event(`build page: ${normalizedPage}`);entries[normalizedPage]={name,absolutePagePath,status:ADDED};doneCallbacks.once(normalizedPage,handleCallback);invalidator.invalidate();function handleCallback(err){if(err)return reject(err);resolve();}});},middleware(){return(req,res,next)=>{if(stopped){// If this handler is stopped, we need to reload the user's browser.
// So the user could connect to the actually running handler.
res.statusCode=302;res.setHeader('Location',req.url);res.end('302');}else if(reloading){// Webpack config is reloading. So, we need to wait until it's done and
// reload user's browser.
// So the user could connect to the new handler and webpack setup.
this.waitUntilReloaded().then(()=>{res.statusCode=302;res.setHeader('Location',req.url);res.end('302');});}else{if(!/^\/_next\/webpack-hmr/.test(req.url))return next();const{query}=(0,_url.parse)(req.url,true);const page=query.page;if(!page)return next();const runPing=()=>{const data=handlePing(query.page);if(!data)return;res.write('data: '+JSON.stringify(data)+'\n\n');};const pingInterval=setInterval(()=>runPing(),5000);req.on('close',()=>{clearInterval(pingInterval);});// Do initial ping right after EventSource is finished being set up
setImmediate(()=>runPing());next();}};}};}function disposeInactiveEntries(devMiddleware,entries,lastAccessPages,maxInactiveAge){const disposingPages=[];Object.keys(entries).forEach(page=>{const{lastActiveTime,status}=entries[page];// This means this entry is currently building or just added
// We don't need to dispose those entries.
if(status!==BUILT)return;// We should not build the last accessed page even we didn't get any pings
// Sometimes, it's possible our XHR ping to wait before completing other requests.
// In that case, we should not dispose the current viewing page
if(lastAccessPages.includes(page))return;if(Date.now()-lastActiveTime>maxInactiveAge){disposingPages.push(page);}});if(disposingPages.length>0){disposingPages.forEach(page=>{delete entries[page];});Log.event(`disposing inactive page(s): ${disposingPages.join(', ')}`);devMiddleware.invalidate();}}// /index and / is the same. So, we need to identify both pages as the same.
// This also applies to sub pages as well.
function normalizePage(page){const unixPagePath=page.replace(/\\/g,'/');if(unixPagePath==='/index'||unixPagePath==='/'){return'/';}return unixPagePath.replace(/\/index$/,'');}// Make sure only one invalidation happens at a time
// Otherwise, webpack hash gets changed and it'll force the client to reload.
class Invalidator{constructor(devMiddleware,multiCompiler){this.multiCompiler=void 0;this.devMiddleware=void 0;this.building=void 0;this.rebuildAgain=void 0;this.multiCompiler=multiCompiler;this.devMiddleware=devMiddleware;// contains an array of types of compilers currently building
this.building=false;this.rebuildAgain=false;}invalidate(){// If there's a current build is processing, we won't abort it by invalidating.
// (If aborted, it'll cause a client side hard reload)
// But let it to invalidate just after the completion.
// So, it can re-build the queued pages at once.
if(this.building){this.rebuildAgain=true;return;}this.building=true;// Work around a bug in webpack, calling `invalidate` on Watching.js
// doesn't trigger the invalid call used to keep track of the `.done` hook on multiCompiler
for(const compiler of this.multiCompiler.compilers){compiler.hooks.invalid.call();}this.devMiddleware.invalidate();}startBuilding(){this.building=true;}doneBuilding(){this.building=false;if(this.rebuildAgain){this.rebuildAgain=false;this.invalidate();}}}