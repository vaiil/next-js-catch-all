/// <reference types="node" />
import { BinaryLike } from 'crypto';
export declare function setDistDir(_distDir: string): void;
export declare function computeHash(payload: BinaryLike): string | null;
export declare function setTelemetryEnabled(_enabled: boolean): void;
export declare function isTelemetryEnabled(): boolean;
declare type TelemetryEvent = {
    eventName: string;
    payload: object;
};
export declare function record(_events: TelemetryEvent | TelemetryEvent[]): Promise<{
    isFulfilled: boolean;
    isRejected: boolean;
    value?: any;
    reason?: any;
}>;
export {};
