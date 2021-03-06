"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_match_1 = __importDefault(require("./lib/path-match"));
exports.route = path_match_1.default();
class Router {
    constructor(routes = []) {
        this.routes = routes;
    }
    add(route) {
        this.routes.unshift(route);
    }
    match(req, res, parsedUrl) {
        const { pathname } = parsedUrl;
        for (const route of this.routes) {
            const params = route.match(pathname);
            if (params) {
                return () => route.fn(req, res, params, parsedUrl);
            }
        }
    }
}
exports.default = Router;
