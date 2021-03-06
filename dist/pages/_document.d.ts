import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { DocumentContext, DocumentInitialProps, DocumentProps } from '../next-server/lib/utils';
export { DocumentContext, DocumentInitialProps, DocumentProps };
export declare type OriginProps = {
    nonce?: string;
    crossOrigin?: string;
};
export declare type DocumentComponentContext = {
    readonly _documentProps: DocumentProps;
    readonly _devOnlyInvalidateCacheQueryString: string;
};
export declare function middleware({ req, res }: DocumentContext): Promise<void>;
/**
 * `Document` component handles the initial `document` markup and renders only on the server side.
 * Commonly used for implementing server side rendering for `css-in-js` libraries.
 */
export default class Document<P = {}> extends Component<DocumentProps & P> {
    static childContextTypes: {
        _documentProps: PropTypes.Requireable<any>;
        _devOnlyInvalidateCacheQueryString: PropTypes.Requireable<string>;
    };
    /**
     * `getInitialProps` hook returns the context object with the addition of `renderPage`.
     * `renderPage` callback executes `React` rendering logic synchronously to support server-rendering wrappers
     */
    static getInitialProps({ renderPage, }: DocumentContext): Promise<DocumentInitialProps>;
    context: DocumentComponentContext;
    getChildContext(): DocumentComponentContext;
    render(): JSX.Element;
}
export declare class Html extends Component<React.DetailedHTMLProps<React.HtmlHTMLAttributes<HTMLHtmlElement>, HTMLHtmlElement>> {
    static contextTypes: {
        _documentProps: PropTypes.Requireable<any>;
    };
    static propTypes: {
        children: PropTypes.Validator<string | number | boolean | {} | PropTypes.ReactElementLike | PropTypes.ReactNodeArray>;
    };
    context: DocumentComponentContext;
    render(): JSX.Element;
}
export declare class Head extends Component<OriginProps & React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadElement>, HTMLHeadElement>> {
    static contextTypes: {
        _documentProps: PropTypes.Requireable<any>;
        _devOnlyInvalidateCacheQueryString: PropTypes.Requireable<string>;
    };
    static propTypes: {
        nonce: PropTypes.Requireable<string>;
        crossOrigin: PropTypes.Requireable<string>;
    };
    context: DocumentComponentContext;
    getCssLinks(): JSX.Element[] | null;
    getPreloadDynamicChunks(): (JSX.Element | null)[];
    getPreloadMainLinks(): (JSX.Element | null)[] | null;
    render(): JSX.Element;
}
export declare class Main extends Component {
    static contextTypes: {
        _documentProps: PropTypes.Requireable<any>;
        _devOnlyInvalidateCacheQueryString: PropTypes.Requireable<string>;
    };
    context: DocumentComponentContext;
    render(): JSX.Element | "__NEXT_AMP_RENDER_TARGET__";
}
export declare class NextScript extends Component<OriginProps> {
    static contextTypes: {
        _documentProps: PropTypes.Requireable<any>;
        _devOnlyInvalidateCacheQueryString: PropTypes.Requireable<string>;
    };
    static propTypes: {
        nonce: PropTypes.Requireable<string>;
        crossOrigin: PropTypes.Requireable<string>;
    };
    context: DocumentComponentContext;
    static safariNomoduleFix: string;
    getDynamicChunks(): (JSX.Element | null)[];
    getScripts(): (JSX.Element | null)[] | null;
    static getInlineScriptSource(documentProps: DocumentProps): string;
    render(): JSX.Element | null;
}
