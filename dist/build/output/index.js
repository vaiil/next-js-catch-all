"use strict";exports.__esModule=true;exports.startedDevelopmentServer=startedDevelopmentServer;exports.formatAmpMessages=formatAmpMessages;exports.ampValidation=ampValidation;exports.watchCompilers=watchCompilers;var _chalk=_interopRequireDefault(require("chalk"));var _textTable=_interopRequireDefault(require("next/dist/compiled/text-table"));var _unistore=_interopRequireDefault(require("next/dist/compiled/unistore"));var _stripAnsi=_interopRequireDefault(require("strip-ansi"));var _formatWebpackMessages=_interopRequireDefault(require("../../client/dev/error-overlay/format-webpack-messages"));var _store=require("./store");var _forkTsCheckerWebpackPlugin=_interopRequireDefault(require("fork-ts-checker-webpack-plugin"));var _codeframeFormatter=require("fork-ts-checker-webpack-plugin/lib/formatter/codeframeFormatter");function _interopRequireDefault(obj){return obj&&obj.__esModule?obj:{default:obj};}function startedDevelopmentServer(appUrl){_store.store.setState({appUrl});}let previousClient=null;let previousServer=null;var WebpackStatusPhase;(function(WebpackStatusPhase){WebpackStatusPhase[WebpackStatusPhase["COMPILING"]=1]="COMPILING";WebpackStatusPhase[WebpackStatusPhase["COMPILED_WITH_ERRORS"]=2]="COMPILED_WITH_ERRORS";WebpackStatusPhase[WebpackStatusPhase["TYPE_CHECKING"]=3]="TYPE_CHECKING";WebpackStatusPhase[WebpackStatusPhase["COMPILED_WITH_WARNINGS"]=4]="COMPILED_WITH_WARNINGS";WebpackStatusPhase[WebpackStatusPhase["COMPILED"]=5]="COMPILED";})(WebpackStatusPhase||(WebpackStatusPhase={}));function getWebpackStatusPhase(status){if(status.loading){return WebpackStatusPhase.COMPILING;}if(status.errors){return WebpackStatusPhase.COMPILED_WITH_ERRORS;}if(status.typeChecking){return WebpackStatusPhase.TYPE_CHECKING;}if(status.warnings){return WebpackStatusPhase.COMPILED_WITH_WARNINGS;}return WebpackStatusPhase.COMPILED;}function formatAmpMessages(amp){let output=_chalk.default.bold('Amp Validation')+'\n\n';let messages=[];const chalkError=_chalk.default.red('error');function ampError(page,error){messages.push([page,chalkError,error.message,error.specUrl||'']);}const chalkWarn=_chalk.default.yellow('warn');function ampWarn(page,warn){messages.push([page,chalkWarn,warn.message,warn.specUrl||'']);}for(const page in amp){let{errors,warnings}=amp[page];const devOnlyFilter=err=>err.code!=='DEV_MODE_ONLY';errors=errors.filter(devOnlyFilter);warnings=warnings.filter(devOnlyFilter);if(!(errors.length||warnings.length)){// Skip page with no non-dev warnings
continue;}if(errors.length){ampError(page,errors[0]);for(let index=1;index<errors.length;++index){ampError('',errors[index]);}}if(warnings.length){ampWarn(errors.length?'':page,warnings[0]);for(let index=1;index<warnings.length;++index){ampWarn('',warnings[index]);}}messages.push(['','','','']);}if(!messages.length){return'';}output+=(0,_textTable.default)(messages,{align:['l','l','l','l'],stringLength(str){return(0,_stripAnsi.default)(str).length;}});return output;}const buildStore=(0,_unistore.default)();buildStore.subscribe(state=>{const{amp,client,server}=state;const[{status}]=[{status:client,phase:getWebpackStatusPhase(client)},{status:server,phase:getWebpackStatusPhase(server)}].sort((a,b)=>a.phase.valueOf()-b.phase.valueOf());const{bootstrap:bootstrapping,appUrl}=_store.store.getState();if(bootstrapping&&status.loading){return;}let partialState={bootstrap:false,appUrl:appUrl};if(status.loading){_store.store.setState({...partialState,loading:true},true);}else{let{errors,warnings,typeChecking}=status;if(errors==null){if(typeChecking){_store.store.setState({...partialState,loading:false,typeChecking:true,errors,warnings},true);return;}if(Object.keys(amp).length>0){warnings=(warnings||[]).concat(formatAmpMessages(amp));if(!warnings.length)warnings=null;}}_store.store.setState({...partialState,loading:false,typeChecking:false,errors,warnings},true);}});function ampValidation(page,errors,warnings){const{amp}=buildStore.getState();if(!(errors.length||warnings.length)){buildStore.setState({amp:Object.keys(amp).filter(k=>k!==page).sort().reduce((a,c)=>(a[c]=amp[c],a),{})});return;}const newAmp={...amp,[page]:{errors,warnings}};buildStore.setState({amp:Object.keys(newAmp).sort().reduce((a,c)=>(a[c]=newAmp[c],a),{})});}function watchCompilers(client,server,enableTypeCheckingOnClient,onTypeChecked){if(previousClient===client&&previousServer===server){return;}buildStore.setState({client:{loading:true},server:{loading:true}});function tapCompiler(key,compiler,hasTypeChecking,onEvent){let tsMessagesPromise;let tsMessagesResolver;compiler.hooks.invalid.tap(`NextJsInvalid-${key}`,()=>{tsMessagesPromise=undefined;onEvent({loading:true});});if(hasTypeChecking){const typescriptFormatter=(0,_codeframeFormatter.createCodeframeFormatter)({});compiler.hooks.beforeCompile.tap(`NextJs-${key}-StartTypeCheck`,()=>{tsMessagesPromise=new Promise(resolve=>{tsMessagesResolver=msgs=>resolve(msgs);});});_forkTsCheckerWebpackPlugin.default.getCompilerHooks(compiler).receive.tap(`NextJs-${key}-afterTypeScriptCheck`,(diagnostics,lints)=>{const allMsgs=[...diagnostics,...lints];const format=message=>typescriptFormatter(message,true);const errors=allMsgs.filter(msg=>msg.severity==='error').map(d=>({file:(d.file||'').replace(/\\/g,'/'),message:format(d)}));const warnings=allMsgs.filter(msg=>msg.severity==='warning').map(d=>({file:(d.file||'').replace(/\\/g,'/'),message:format(d)}));tsMessagesResolver({errors:errors.length?errors:null,warnings:warnings.length?warnings:null});});}compiler.hooks.done.tap(`NextJsDone-${key}`,stats=>{buildStore.setState({amp:{}});const{errors,warnings}=(0,_formatWebpackMessages.default)(stats.toJson({all:false,warnings:true,errors:true}));const hasErrors=errors&&errors.length;const hasWarnings=warnings&&warnings.length;onEvent({loading:false,typeChecking:hasTypeChecking,errors:hasErrors?errors:null,warnings:hasWarnings?warnings:null});const typePromise=tsMessagesPromise;if(!hasErrors&&typePromise){typePromise.then(typeMessages=>{if(typePromise!==tsMessagesPromise){// a new compilation started so we don't care about this
return;}const reportFiles=stats.compilation.modules.map(m=>(m.resource||'').replace(/\\/g,'/')).filter(Boolean);let filteredErrors=typeMessages.errors?typeMessages.errors.filter(({file})=>file&&reportFiles.includes(file)).map(({message})=>message):null;if(filteredErrors&&filteredErrors.length<1){filteredErrors=null;}let filteredWarnings=typeMessages.warnings?typeMessages.warnings.filter(({file})=>file&&reportFiles.includes(file)).map(({message})=>message):null;if(filteredWarnings&&filteredWarnings.length<1){filteredWarnings=null;}stats.compilation.errors.push(...(filteredErrors||[]));stats.compilation.warnings.push(...(filteredWarnings||[]));onTypeChecked({errors:stats.compilation.errors.length?stats.compilation.errors:null,warnings:stats.compilation.warnings.length?stats.compilation.warnings:null});onEvent({loading:false,typeChecking:false,errors:filteredErrors,warnings:hasWarnings?[...warnings,...(filteredWarnings||[])]:filteredWarnings});});}});}tapCompiler('client',client,enableTypeCheckingOnClient,status=>buildStore.setState({client:status}));tapCompiler('server',server,false,status=>buildStore.setState({server:status}));previousClient=client;previousServer=server;}