import { Config } from './config';
import { UserProps, EventPayload, Transport } from './types';
import { Logger } from '../utils/logger';
import { CookieManager } from '../utils/cookie';
import { AutoCapture } from '../tracking/autocapture';
import { FormTracking } from '../tracking/form-tracking';
import { PageviewTracking } from '../tracking/pageviews';
import { BeaconTransport } from '../transport/beacon';
import { FetchTransport } from '../transport/fetch';
import { XhrTransport } from '../transport/xhr';
import { LocalStoragePersistence } from '../persistence/local-storage';
import { MemoryPersistence } from '../persistence/memory';
import {generateId, parseQueryString} from '../utils/helpers';

export class UsermavenClient {
    private config: Config;
    private logger: Logger;
    private cookieManager: CookieManager;
    private transport: Transport;
    private persistence: LocalStoragePersistence | MemoryPersistence;
    private autoCapture?: AutoCapture;
    private formTracking?: FormTracking;
    private pageviewTracking?: PageviewTracking;

    constructor(config: Config) {
        this.config = config;
        this.logger = new Logger(config.logLevel || 1);
        this.cookieManager = new CookieManager(config.cookieDomain, config.cookieName);
        this.transport = this.initializeTransport();
        this.persistence = this.initializePersistence();

        if (config.autocapture) {
            this.autoCapture = new AutoCapture(this);
        }

        if (config.formTracking) {
            this.formTracking = new FormTracking(this);
        }

        if (config.autoPageview) {
            this.pageviewTracking = new PageviewTracking(this);
        }
    }


    public init(config: Partial<Config>): void {
        // Merge the new config with the existing one
        this.config = { ...this.config, ...config };

        // Reinitialize components with the new config
        this.logger = new Logger(this.config.logLevel || 1);
        this.cookieManager = new CookieManager(this.config.cookieDomain, this.config.cookieName);
        this.transport = this.initializeTransport();
        this.persistence = this.initializePersistence();

        if (this.config.autocapture) {
            this.autoCapture = new AutoCapture(this);
        }

        if (this.config.formTracking) {
            this.formTracking = new FormTracking(this);
        }

        if (this.config.autoPageview) {
            this.pageviewTracking = new PageviewTracking(this);
        }

        this.logger.info('Usermaven client initialized');
    }

    private initializeTransport(): Transport {
        if (this.config.useBeaconApi && navigator.sendBeacon) {
            return new BeaconTransport(this.config.trackingHost);
        } else if (this.config.forceUseFetch || !window?.XMLHttpRequest) {
            return new FetchTransport(this.config.trackingHost);
        } else {
            return new XhrTransport(this.config.trackingHost);
        }
    }

    private initializePersistence(): LocalStoragePersistence | MemoryPersistence {
        if (this.config.disableEventPersistence) {
            return new MemoryPersistence();
        } else {
            return new LocalStoragePersistence(this.config.apiKey);
        }
    }

    public identify(userProps: UserProps): void {
        const userId = userProps.id || generateId();
        this.persistence.set('userId', userId);
        this.persistence.set('userProps', userProps);
        this.track('identify', userProps);
    }

    public track(eventName: string, eventProps?: EventPayload): void {
        const payload = this.createEventPayload(eventName, eventProps);
        this.transport.send(payload);
    }

    private createEventPayload(eventName: string, eventProps?: EventPayload): any {
        const userProps = this.persistence.get('userProps') || {};
        const userId = this.persistence.get('userId');
        const anonymousId = this.getCookie(this.config.cookieName || '') || generateId();

        return {
            event_id: "",
            user: {
                anonymous_id: anonymousId,
                id: userId,
                ...userProps
            },
            ids: this.getThirdPartyIds(),
            utc_time: new Date().toISOString(),
            local_tz_offset: new Date().getTimezoneOffset(),
            referer: document.referrer,
            url: window.location.href,
            page_title: document.title,
            doc_path: window.location.pathname,
            doc_host: window.location.hostname,
            doc_search: window.location.search,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            vp_size: `${window.innerWidth}x${window.innerHeight}`,
            user_agent: navigator.userAgent,
            user_language: navigator.language,
            doc_encoding: document.characterSet,
            utm: this.getUtmParams(),
            click_id: {},
            api_key: this.config.apiKey,
            src: "usermaven",
            event_type: eventName,
            ...eventProps
        };
    }

    public getCookie(name: string): string | null {
        return this.cookieManager.get(name);
    }

    private getThirdPartyIds(): Record<string, string> {
        const thirdPartyIds: Record<string, string> = {};
        const fbpCookie = this.getCookie('_fbp');
        if (fbpCookie) {
            thirdPartyIds['fbp'] = fbpCookie;
        }
        // Add more third-party IDs as needed
        return thirdPartyIds;
    }

    private getUtmParams(): Record<string, string> {
        const utmParams: Record<string, string> = {};
        const queryParams = parseQueryString(window.location.search);
        const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

        utmKeys.forEach(key => {
            if (queryParams[key]) {
                utmParams[key.replace('utm_', '')] = queryParams[key];
            }
        });

        return utmParams;
    }

    public pageview(): void {
        this.track('pageview', {
            url: window.location.href,
            referrer: document.referrer,
            title: document.title,
        });
    }

    public getConfig(): Config {
        return this.config;
    }

    public getLogger(): Logger {
        return this.logger;
    }
}
