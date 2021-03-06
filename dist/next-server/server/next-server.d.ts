/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { ParsedUrlQuery } from 'querystring';
import { UrlWithParsedQuery } from 'url';
import Router, { Route, RouteMatch } from './router';
declare type NextConfig = any;
export declare type ServerConstructor = {
    /**
     * Where the Next project is located - @default '.'
     */
    dir?: string;
    staticMarkup?: boolean;
    /**
     * Hide error messages containing server information - @default false
     */
    quiet?: boolean;
    /**
     * Object what you would use in next.config.js - @default {}
     */
    conf?: NextConfig;
    dev?: boolean;
};
export default class Server {
    dir: string;
    quiet: boolean;
    nextConfig: NextConfig;
    distDir: string;
    pagesDir?: string;
    publicDir: string;
    pagesManifest: string;
    buildId: string;
    renderOpts: {
        poweredByHeader: boolean;
        ampBindInitData: boolean;
        staticMarkup: boolean;
        buildId: string;
        generateEtags: boolean;
        runtimeConfig?: {
            [key: string]: any;
        };
        assetPrefix?: string;
        canonicalBase: string;
        documentMiddlewareEnabled: boolean;
        hasCssMode: boolean;
        dev?: boolean;
    };
    private compression?;
    router: Router;
    protected dynamicRoutes?: Array<{
        page: string;
        match: RouteMatch;
    }>;
    constructor({ dir, staticMarkup, quiet, conf, dev, }?: ServerConstructor);
    protected currentPhase(): string;
    private logError;
    private handleRequest;
    getRequestHandler(): (req: IncomingMessage, res: ServerResponse, parsedUrl?: UrlWithParsedQuery | undefined) => Promise<void>;
    setAssetPrefix(prefix?: string): void;
    prepare(): Promise<void>;
    protected close(): Promise<void>;
    protected setImmutableAssetCacheControl(res: ServerResponse): void;
    protected generateRoutes(): Route[];
    /**
     * Resolves `API` request, in development builds on demand
     * @param req http request
     * @param res http response
     * @param pathname path of request
     */
    private handleApiRequest;
    /**
     * Resolves path to resolver function
     * @param pathname path of request
     */
    protected resolveApiRequest(pathname: string): Promise<string | null>;
    protected generatePublicRoutes(): Route[];
    protected getDynamicRoutes(): {
        page: string;
        match: (pathname: string | undefined) => false | {
            [paramName: string]: string;
        };
    }[];
    private handleCompression;
    protected run(req: IncomingMessage, res: ServerResponse, parsedUrl: UrlWithParsedQuery): Promise<void>;
    protected sendHTML(req: IncomingMessage, res: ServerResponse, html: string): Promise<void>;
    render(req: IncomingMessage, res: ServerResponse, pathname: string, query?: ParsedUrlQuery, parsedUrl?: UrlWithParsedQuery): Promise<void>;
    private findPageComponents;
    private __sendPayload;
    private renderToHTMLWithComponents;
    renderToHTML(req: IncomingMessage, res: ServerResponse, pathname: string, query?: ParsedUrlQuery, { amphtml, dataOnly, hasAmp, }?: {
        amphtml?: boolean;
        hasAmp?: boolean;
        dataOnly?: boolean;
    }): Promise<string | null>;
    renderError(err: Error | null, req: IncomingMessage, res: ServerResponse, pathname: string, query?: ParsedUrlQuery): Promise<void>;
    renderErrorToHTML(err: Error | null, req: IncomingMessage, res: ServerResponse, _pathname: string, query?: ParsedUrlQuery): Promise<string | null>;
    render404(req: IncomingMessage, res: ServerResponse, parsedUrl?: UrlWithParsedQuery): Promise<void>;
    serveStatic(req: IncomingMessage, res: ServerResponse, path: string, parsedUrl?: UrlWithParsedQuery): Promise<void>;
    private isServeableUrl;
    protected readBuildId(): string;
    private readonly _isLikeServerless;
}
export {};
