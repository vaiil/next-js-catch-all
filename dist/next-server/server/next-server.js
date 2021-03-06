"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const compression_1 = __importDefault(require("compression"));
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const querystring_1 = require("querystring");
const url_1 = require("url");
const coalesced_function_1 = require("../../lib/coalesced-function");
const constants_1 = require("../lib/constants");
const utils_1 = require("../lib/router/utils");
const envConfig = __importStar(require("../lib/runtime-config"));
const utils_2 = require("../lib/utils");
const api_utils_1 = require("./api-utils");
const config_1 = __importStar(require("./config"));
const recursive_readdir_sync_1 = require("./lib/recursive-readdir-sync");
const load_components_1 = require("./load-components");
const render_1 = require("./render");
const require_1 = require("./require");
const router_1 = __importStar(require("./router"));
const send_html_1 = require("./send-html");
const serve_static_1 = require("./serve-static");
const utils_3 = require("./utils");
const spr_cache_1 = require("./spr-cache");
class Server {
    constructor({ dir = '.', staticMarkup = false, quiet = false, conf = null, dev = false, } = {}) {
        this.dir = path_1.resolve(dir);
        this.quiet = quiet;
        const phase = this.currentPhase();
        this.nextConfig = config_1.default(phase, this.dir, conf);
        this.distDir = path_1.join(this.dir, this.nextConfig.distDir);
        this.publicDir = path_1.join(this.dir, constants_1.CLIENT_PUBLIC_FILES_PATH);
        this.pagesManifest = path_1.join(this.distDir, this.nextConfig.target === 'server'
            ? constants_1.SERVER_DIRECTORY
            : constants_1.SERVERLESS_DIRECTORY, constants_1.PAGES_MANIFEST);
        // Only serverRuntimeConfig needs the default
        // publicRuntimeConfig gets it's default in client/index.js
        const { serverRuntimeConfig = {}, publicRuntimeConfig, assetPrefix, generateEtags, compress, } = this.nextConfig;
        this.buildId = this.readBuildId();
        this.renderOpts = {
            ampBindInitData: this.nextConfig.experimental.ampBindInitData,
            poweredByHeader: this.nextConfig.poweredByHeader,
            canonicalBase: this.nextConfig.amp.canonicalBase,
            documentMiddlewareEnabled: this.nextConfig.experimental
                .documentMiddleware,
            hasCssMode: this.nextConfig.experimental.css,
            staticMarkup,
            buildId: this.buildId,
            generateEtags,
        };
        // Only the `publicRuntimeConfig` key is exposed to the client side
        // It'll be rendered as part of __NEXT_DATA__ on the client side
        if (Object.keys(publicRuntimeConfig).length > 0) {
            this.renderOpts.runtimeConfig = publicRuntimeConfig;
        }
        if (compress && this.nextConfig.target === 'server') {
            this.compression = compression_1.default();
        }
        // Initialize next/config with the environment configuration
        envConfig.setConfig({
            serverRuntimeConfig,
            publicRuntimeConfig,
        });
        const routes = this.generateRoutes();
        this.router = new router_1.default(routes);
        this.setAssetPrefix(assetPrefix);
        spr_cache_1.initializeSprCache({
            dev,
            distDir: this.distDir,
            pagesDir: path_1.join(this.distDir, this._isLikeServerless
                ? constants_1.SERVERLESS_DIRECTORY
                : `${constants_1.SERVER_DIRECTORY}/static/${this.buildId}`, 'pages'),
            flushToDisk: this.nextConfig.experimental.sprFlushToDisk,
        });
    }
    currentPhase() {
        return constants_1.PHASE_PRODUCTION_SERVER;
    }
    logError(...args) {
        if (this.quiet)
            return;
        // tslint:disable-next-line
        console.error(...args);
    }
    handleRequest(req, res, parsedUrl) {
        // Parse url if parsedUrl not provided
        if (!parsedUrl || typeof parsedUrl !== 'object') {
            const url = req.url;
            parsedUrl = url_1.parse(url, true);
        }
        // Parse the querystring ourselves if the user doesn't handle querystring parsing
        if (typeof parsedUrl.query === 'string') {
            parsedUrl.query = querystring_1.parse(parsedUrl.query);
        }
        res.statusCode = 200;
        return this.run(req, res, parsedUrl).catch(err => {
            this.logError(err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        });
    }
    getRequestHandler() {
        return this.handleRequest.bind(this);
    }
    setAssetPrefix(prefix) {
        this.renderOpts.assetPrefix = prefix ? prefix.replace(/\/$/, '') : '';
    }
    // Backwards compatibility
    async prepare() { }
    // Backwards compatibility
    async close() { }
    setImmutableAssetCacheControl(res) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    generateRoutes() {
        const routes = [
            {
                match: router_1.route('/_next/static/:path*'),
                fn: async (req, res, params, parsedUrl) => {
                    // The commons folder holds commonschunk files
                    // The chunks folder holds dynamic entries
                    // The buildId folder holds pages and potentially other assets. As buildId changes per build it can be long-term cached.
                    // make sure to 404 for /_next/static itself
                    if (!params.path)
                        return this.render404(req, res, parsedUrl);
                    if (params.path[0] === constants_1.CLIENT_STATIC_FILES_RUNTIME ||
                        params.path[0] === 'chunks' ||
                        params.path[0] === this.buildId) {
                        this.setImmutableAssetCacheControl(res);
                    }
                    const p = path_1.join(this.distDir, constants_1.CLIENT_STATIC_FILES_PATH, ...(params.path || []));
                    await this.serveStatic(req, res, p, parsedUrl);
                },
            },
            {
                match: router_1.route('/_next/data/:path*'),
                fn: async (req, res, params, _parsedUrl) => {
                    // Make sure to 404 for /_next/data/ itself
                    if (!params.path)
                        return this.render404(req, res, _parsedUrl);
                    // TODO: force `.json` to be present
                    const pathname = `/${params.path.join('/')}`.replace(/\.json$/, '');
                    req.url = pathname;
                    const parsedUrl = url_1.parse(pathname, true);
                    await this.render(req, res, pathname, { _nextSprData: '1' }, parsedUrl);
                },
            },
            {
                match: router_1.route('/_next/:path*'),
                // This path is needed because `render()` does a check for `/_next` and the calls the routing again
                fn: async (req, res, _params, parsedUrl) => {
                    await this.render404(req, res, parsedUrl);
                },
            },
            {
                // It's very important to keep this route's param optional.
                // (but it should support as many params as needed, separated by '/')
                // Otherwise this will lead to a pretty simple DOS attack.
                // See more: https://github.com/zeit/next.js/issues/2617
                match: router_1.route('/static/:path*'),
                fn: async (req, res, params, parsedUrl) => {
                    const p = path_1.join(this.dir, 'static', ...(params.path || []));
                    await this.serveStatic(req, res, p, parsedUrl);
                },
            },
            {
                match: router_1.route('/api/:path*'),
                fn: async (req, res, params, parsedUrl) => {
                    const { pathname } = parsedUrl;
                    await this.handleApiRequest(req, res, pathname);
                },
            },
        ];
        if (fs_1.default.existsSync(this.publicDir)) {
            routes.push(...this.generatePublicRoutes());
        }
        if (this.nextConfig.useFileSystemPublicRoutes) {
            this.dynamicRoutes = this.getDynamicRoutes();
            // It's very important to keep this route's param optional.
            // (but it should support as many params as needed, separated by '/')
            // Otherwise this will lead to a pretty simple DOS attack.
            // See more: https://github.com/zeit/next.js/issues/2617
            routes.push({
                match: router_1.route('/:path*'),
                fn: async (req, res, _params, parsedUrl) => {
                    const { pathname, query } = parsedUrl;
                    if (!pathname) {
                        throw new Error('pathname is undefined');
                    }
                    await this.render(req, res, pathname, query, parsedUrl);
                },
            });
        }
        return routes;
    }
    /**
     * Resolves `API` request, in development builds on demand
     * @param req http request
     * @param res http response
     * @param pathname path of request
     */
    async handleApiRequest(req, res, pathname) {
        let params = false;
        let resolverFunction;
        try {
            resolverFunction = await this.resolveApiRequest(pathname);
        }
        catch (err) { }
        if (this.dynamicRoutes &&
            this.dynamicRoutes.length > 0 &&
            !resolverFunction) {
            for (const dynamicRoute of this.dynamicRoutes) {
                params = dynamicRoute.match(pathname);
                if (params) {
                    resolverFunction = await this.resolveApiRequest(dynamicRoute.page);
                    break;
                }
            }
        }
        if (!resolverFunction) {
            return this.render404(req, res);
        }
        if (!this.renderOpts.dev && this._isLikeServerless) {
            const mod = require(resolverFunction);
            if (typeof mod.default === 'function') {
                return mod.default(req, res);
            }
        }
        await api_utils_1.apiResolver(req, res, params, resolverFunction ? require(resolverFunction) : undefined);
    }
    /**
     * Resolves path to resolver function
     * @param pathname path of request
     */
    async resolveApiRequest(pathname) {
        return require_1.getPagePath(pathname, this.distDir, this._isLikeServerless, this.renderOpts.dev);
    }
    generatePublicRoutes() {
        const routes = [];
        const publicFiles = recursive_readdir_sync_1.recursiveReadDirSync(this.publicDir);
        const serverBuildPath = path_1.join(this.distDir, this._isLikeServerless ? constants_1.SERVERLESS_DIRECTORY : constants_1.SERVER_DIRECTORY);
        const pagesManifest = require(path_1.join(serverBuildPath, constants_1.PAGES_MANIFEST));
        publicFiles.forEach(path => {
            const unixPath = path.replace(/\\/g, '/');
            // Only include public files that will not replace a page path
            if (!pagesManifest[unixPath]) {
                routes.push({
                    match: router_1.route(unixPath),
                    fn: async (req, res, _params, parsedUrl) => {
                        const p = path_1.join(this.publicDir, unixPath);
                        await this.serveStatic(req, res, p, parsedUrl);
                    },
                });
            }
        });
        return routes;
    }
    getDynamicRoutes() {
        const manifest = require(this.pagesManifest);
        const dynamicRoutedPages = Object.keys(manifest).filter(utils_1.isDynamicRoute);
        return utils_1.getSortedRoutes(dynamicRoutedPages).map(page => ({
            page,
            match: utils_1.getRouteMatcher(utils_1.getRouteRegex(page)),
        }));
    }
    handleCompression(req, res) {
        if (this.compression) {
            this.compression(req, res, () => { });
        }
    }
    async run(req, res, parsedUrl) {
        this.handleCompression(req, res);
        try {
            const fn = this.router.match(req, res, parsedUrl);
            if (fn) {
                await fn();
                return;
            }
        }
        catch (err) {
            if (err.code === 'DECODE_FAILED') {
                res.statusCode = 400;
                return this.renderError(null, req, res, '/_error', {});
            }
            throw err;
        }
        await this.render404(req, res, parsedUrl);
    }
    async sendHTML(req, res, html) {
        const { generateEtags, poweredByHeader } = this.renderOpts;
        return send_html_1.sendHTML(req, res, html, { generateEtags, poweredByHeader });
    }
    async render(req, res, pathname, query = {}, parsedUrl) {
        const url = req.url;
        if (utils_3.isInternalUrl(url)) {
            return this.handleRequest(req, res, parsedUrl);
        }
        if (utils_3.isBlockedPage(pathname)) {
            return this.render404(req, res, parsedUrl);
        }
        const html = await this.renderToHTML(req, res, pathname, query, {
            dataOnly: (this.renderOpts.ampBindInitData && Boolean(query.dataOnly)) ||
                (req.headers &&
                    (req.headers.accept || '').indexOf('application/amp.bind+json') !==
                        -1),
        });
        // Request was ended by the user
        if (html === null) {
            return;
        }
        return this.sendHTML(req, res, html);
    }
    async findPageComponents(pathname, query = {}) {
        const serverless = !this.renderOpts.dev && this._isLikeServerless;
        // try serving a static AMP version first
        if (query.amp) {
            try {
                return await load_components_1.loadComponents(this.distDir, this.buildId, (pathname === '/' ? '/index' : pathname) + '.amp', serverless);
            }
            catch (err) {
                if (err.code !== 'ENOENT')
                    throw err;
            }
        }
        return await load_components_1.loadComponents(this.distDir, this.buildId, pathname, serverless);
    }
    __sendPayload(res, payload, type, revalidate) {
        // TODO: ETag? Cache-Control headers? Next-specific headers?
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Length', Buffer.byteLength(payload));
        if (revalidate) {
            res.setHeader('Cache-Control', `s-maxage=${revalidate}, stale-while-revalidate`);
        }
        res.end(payload);
    }
    async renderToHTMLWithComponents(req, res, pathname, query = {}, result, opts) {
        // handle static page
        if (typeof result.Component === 'string') {
            return result.Component;
        }
        // check request state
        const isLikeServerless = typeof result.Component === 'object' &&
            typeof result.Component.renderReqToHTML === 'function';
        const isSpr = !!result.unstable_getStaticProps;
        // non-spr requests should render like normal
        if (!isSpr) {
            // handle serverless
            if (isLikeServerless) {
                return result.Component.renderReqToHTML(req, res);
            }
            return render_1.renderToHTML(req, res, pathname, query, Object.assign({}, result, opts));
        }
        // Toggle whether or not this is an SPR Data request
        const isSprData = isSpr && query._nextSprData;
        if (isSprData) {
            delete query._nextSprData;
        }
        // Compute the SPR cache key
        const sprCacheKey = url_1.parse(req.url || '').pathname;
        // Complete the response with cached data if its present
        const cachedData = await spr_cache_1.getSprCache(sprCacheKey);
        if (cachedData) {
            const data = isSprData
                ? JSON.stringify(cachedData.pageData)
                : cachedData.html;
            this.__sendPayload(res, data, isSprData ? 'application/json' : 'text/html; charset=utf-8', cachedData.curRevalidate);
            // Stop the request chain here if the data we sent was up-to-date
            if (!cachedData.isStale) {
                return null;
            }
        }
        // If we're here, that means data is missing or it's stale.
        // Serverless requests need its URL transformed back into the original
        // request path (to emulate lambda behavior in production)
        if (isLikeServerless && isSprData) {
            const curUrl = url_1.parse(req.url || '', true);
            req.url = `/_next/data${curUrl.pathname}.json`;
        }
        const doRender = coalesced_function_1.withCoalescedInvoke(async function () {
            let sprData;
            let html;
            let sprRevalidate;
            let renderResult;
            // handle serverless
            if (isLikeServerless) {
                renderResult = await result.Component.renderReqToHTML(req, res, true);
                html = renderResult.html;
                sprData = renderResult.renderOpts.sprData;
                sprRevalidate = renderResult.renderOpts.revalidate;
            }
            else {
                const renderOpts = Object.assign({}, result, opts);
                renderResult = await render_1.renderToHTML(req, res, pathname, query, renderOpts);
                html = renderResult;
                sprData = renderOpts.sprData;
                sprRevalidate = renderOpts.revalidate;
            }
            return { html, sprData, sprRevalidate };
        });
        return doRender(sprCacheKey, []).then(async ({ isOrigin, value: { html, sprData, sprRevalidate } }) => {
            // Respond to the request if a payload wasn't sent above (from cache)
            if (!utils_2.isResSent(res)) {
                this.__sendPayload(res, isSprData ? JSON.stringify(sprData) : html, isSprData ? 'application/json' : 'text/html; charset=utf-8', sprRevalidate);
            }
            // Update the SPR cache if the head request
            if (isOrigin) {
                await spr_cache_1.setSprCache(sprCacheKey, { html: html, pageData: sprData }, sprRevalidate);
            }
            return null;
        });
    }
    renderToHTML(req, res, pathname, query = {}, { amphtml, dataOnly, hasAmp, } = {}) {
        return this.findPageComponents(pathname, query)
            .then(result => {
            return this.renderToHTMLWithComponents(req, res, pathname, query, result, Object.assign({}, this.renderOpts, { amphtml, hasAmp, dataOnly }));
        }, err => {
            if (err.code !== 'ENOENT' || !this.dynamicRoutes) {
                return Promise.reject(err);
            }
            for (const dynamicRoute of this.dynamicRoutes) {
                const params = dynamicRoute.match(pathname);
                if (!params) {
                    continue;
                }
                return this.findPageComponents(dynamicRoute.page, query).then(result => {
                    return this.renderToHTMLWithComponents(req, res, dynamicRoute.page, Object.assign({}, (result.unstable_getStaticProps
                        ? { _nextSprData: query._nextSprData }
                        : query), params), result, Object.assign({}, this.renderOpts, { amphtml,
                        hasAmp,
                        dataOnly }));
                });
            }
            return Promise.reject(err);
        })
            .catch(err => {
            if (err && err.code === 'ENOENT') {
                res.statusCode = 404;
                return this.renderErrorToHTML(null, req, res, pathname, query);
            }
            else {
                this.logError(err);
                res.statusCode = 500;
                return this.renderErrorToHTML(err, req, res, pathname, query);
            }
        });
    }
    async renderError(err, req, res, pathname, query = {}) {
        res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
        const html = await this.renderErrorToHTML(err, req, res, pathname, query);
        if (html === null) {
            return;
        }
        return this.sendHTML(req, res, html);
    }
    async renderErrorToHTML(err, req, res, _pathname, query = {}) {
        const result = await this.findPageComponents('/_error', query);
        let html;
        try {
            html = await this.renderToHTMLWithComponents(req, res, '/_error', query, result, Object.assign({}, this.renderOpts, { err }));
        }
        catch (err) {
            console.error(err);
            res.statusCode = 500;
            html = 'Internal Server Error';
        }
        return html;
    }
    async render404(req, res, parsedUrl) {
        const url = req.url;
        const { pathname, query } = parsedUrl ? parsedUrl : url_1.parse(url, true);
        if (!pathname) {
            throw new Error('pathname is undefined');
        }
        res.statusCode = 404;
        return this.renderError(null, req, res, pathname, query);
    }
    async serveStatic(req, res, path, parsedUrl) {
        if (!this.isServeableUrl(path)) {
            return this.render404(req, res, parsedUrl);
        }
        if (!(req.method === 'GET' || req.method === 'HEAD')) {
            res.statusCode = 405;
            res.setHeader('Allow', ['GET', 'HEAD']);
            return this.renderError(null, req, res, path);
        }
        try {
            await serve_static_1.serveStatic(req, res, path);
        }
        catch (err) {
            if (err.code === 'ENOENT' || err.statusCode === 404) {
                this.render404(req, res, parsedUrl);
            }
            else if (err.statusCode === 412) {
                res.statusCode = 412;
                return this.renderError(err, req, res, path);
            }
            else {
                throw err;
            }
        }
    }
    isServeableUrl(path) {
        const resolved = path_1.resolve(path);
        if (resolved.indexOf(path_1.join(this.distDir) + path_1.sep) !== 0 &&
            resolved.indexOf(path_1.join(this.dir, 'static') + path_1.sep) !== 0 &&
            resolved.indexOf(path_1.join(this.dir, 'public') + path_1.sep) !== 0) {
            // Seems like the user is trying to traverse the filesystem.
            return false;
        }
        return true;
    }
    readBuildId() {
        const buildIdFile = path_1.join(this.distDir, constants_1.BUILD_ID_FILE);
        try {
            return fs_1.default.readFileSync(buildIdFile, 'utf8').trim();
        }
        catch (err) {
            if (!fs_1.default.existsSync(buildIdFile)) {
                throw new Error(`Could not find a valid build in the '${this.distDir}' directory! Try building your app with 'next build' before starting the server.`);
            }
            throw err;
        }
    }
    get _isLikeServerless() {
        return config_1.isTargetLikeServerless(this.nextConfig.target);
    }
}
exports.default = Server;
