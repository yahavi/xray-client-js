import * as faker from 'faker';
import * as http from 'http';
import { createProxyServer, ServerOptions } from 'http-proxy';
import nock from 'nock';
import { IClientConfig } from '../model';
import { IProxyConfig } from '../model/ProxyConfig';
import { IVersion } from '../model/System/Version';
import { XrayClient } from '../src/XrayClient';
import { TestUtils } from './TestUtils';

let isPassedThroughProxy: boolean;
let xrayClient: XrayClient;

describe('Xray System tests', () => {
    describe('Ping tests', () => {
        const clientConfig: IClientConfig = TestUtils.getClientConfig();
        const PING_RES = { status: 'pong' };
        beforeAll(() => {
            xrayClient = new XrayClient(clientConfig);
        });

        beforeEach(() => {
            process.env.HTTPS_PROXY = '';
            process.env.NO_PROXY = '';
            isPassedThroughProxy = false;
        });

        test('Ping success', async () => {
            const response = await xrayClient.system().ping();
            expect(response).toStrictEqual(PING_RES);
            expect(isPassedThroughProxy).toBeFalsy();
        });

        describe('Ping proxy', () => {
            let proxy: any;
            let proxyXrayClient: XrayClient;
            beforeAll(() => {
                clientConfig.proxy = { port: 9090 } as IProxyConfig;
                proxyXrayClient = new XrayClient(clientConfig);
                proxy = createProxyServer({ target: clientConfig.serverUrl } as ServerOptions).listen(9090);
                proxy.on('proxyReq', () => (isPassedThroughProxy = true));
            });
            afterAll(() => {
                proxy.close();
            });

            test('Ping through proxy', async () => {
                const response = await proxyXrayClient.system().ping();
                expect(response).toStrictEqual(PING_RES);
                expect(isPassedThroughProxy).toBeTruthy();
            });

            test('Ping through proxy env', async () => {
                process.env.HTTPS_PROXY = 'http://127.0.0.1:9090';
                const response = await xrayClient.system().ping();
                expect(response).toStrictEqual(PING_RES);
                expect(isPassedThroughProxy).toBeTruthy();
            });

            test('Ping skip proxy', async () => {
                process.env.HTTPS_PROXY = 'http://127.0.0.1:9090';
                process.env.NO_PROXY = clientConfig.serverUrl;
                const response = await xrayClient.system().ping();
                expect(response).toStrictEqual(PING_RES);
                expect(isPassedThroughProxy).toBeTruthy();
            });

            test('Ping empty proxy', async () => {
                const xrayClientEmptyProxy = new XrayClient({
                    serverUrl: clientConfig.serverUrl,
                    username: clientConfig.username,
                    password: clientConfig.password,
                    proxy: {} as IProxyConfig
                });
                const response = await xrayClientEmptyProxy.system().ping();
                expect(response).toStrictEqual(PING_RES);
                expect(isPassedThroughProxy).toBeFalsy();
            });

            describe('Ping auth proxy', () => {
                const PROXY_USER: string = faker.internet.userName();
                const PROXY_PASS: string = faker.internet.password();
                let proxyAuthXrayClient: XrayClient;
                let authProxy: any;
                beforeAll(() => {
                    clientConfig.proxy = { port: 9091 } as IProxyConfig;
                    clientConfig.headers = { 'proxy-authorization': 'Basic ' + Buffer.from(PROXY_USER + ':' + PROXY_PASS).toString('base64') };
                    proxyAuthXrayClient = new XrayClient(clientConfig);
                    authProxy = createProxyServer({ target: clientConfig.serverUrl } as ServerOptions).listen(9091);
                    authProxy.on('proxyReq', (proxyReq: http.ClientRequest) => {
                        isPassedThroughProxy = true;
                        // Check proxy header
                        const actualAuthHeader = proxyReq.getHeader('proxy-authorization');
                        const expectAuthHeader = 'Basic ' + Buffer.from(PROXY_USER + ':' + PROXY_PASS).toString('base64');
                        expect(actualAuthHeader).toBe(expectAuthHeader);
                    });
                });
                afterAll(() => {
                    authProxy.close();
                });

                test('Ping though auth proxy', async () => {
                    const response = await proxyAuthXrayClient.system().ping();
                    expect(response).toStrictEqual(PING_RES);
                    expect(isPassedThroughProxy).toBeTruthy();
                });
            });
        });

        test('Ping failure', async () => {
            const SERVER_URL: string = faker.internet.url();
            const scope = nock(SERVER_URL)
                .get(`/api/v1/system/ping`)
                .reply(402, { message: 'error' });
            const client = new XrayClient({ serverUrl: SERVER_URL });
            const res = await client.system().ping();
            expect(res).toBeFalsy();
            expect(scope.isDone()).toBeTruthy();
            expect(isPassedThroughProxy).toBeFalsy();
        });
    });

    test('Version', async () => {
        const version: IVersion = await xrayClient.system().version();
        expect(version.xray_version).toBeTruthy();
        expect(version.xray_revision).toBeTruthy();
        expect(isPassedThroughProxy).toBeFalsy();
    });
});