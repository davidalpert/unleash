import dbInit, { ITestDb } from '../../helpers/database-init';
import { setupAppWithCustomConfig } from '../../helpers/test-helper';
import getLogger from '../../../fixtures/no-logger';
import { IClientMetricsEnv } from '../../../../lib/types/stores/client-metrics-store-v2';

let app;
let db: ITestDb;

beforeAll(async () => {
    db = await dbInit('client_metrics_serial', getLogger);
    app = await setupAppWithCustomConfig(db.stores, {
        experimental: { metricsV2: { enabled: true } },
    });
});

afterAll(async () => {
    if (db) {
        await db.destroy();
    }
});

afterEach(async () => {
    await db.reset();
    await db.stores.clientMetricsStoreV2.deleteAll();
});

test('should return raw metrics, aggregated on key', async () => {
    const date = new Date();
    const metrics: IClientMetricsEnv[] = [
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 2,
            no: 2,
        },
        {
            featureName: 't2',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 5,
            no: 5,
        },
        {
            featureName: 't2',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 2,
            no: 99,
        },
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 3,
            no: 2,
        },
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'test',
            timestamp: date,
            yes: 1,
            no: 3,
        },
    ];

    await db.stores.clientMetricsStoreV2.batchInsertMetrics(metrics);

    const { body: demo } = await app.request
        .get('/api/admin/client-metrics/features/demo/raw')
        .expect('Content-Type', /json/)
        .expect(200);
    const { body: t2 } = await app.request
        .get('/api/admin/client-metrics/features/t2/raw')
        .expect('Content-Type', /json/)
        .expect(200);

    expect(demo.data).toHaveLength(2);
    expect(demo.data[0].environment).toBe('default');
    expect(demo.data[0].yes).toBe(5);
    expect(demo.data[0].no).toBe(4);
    expect(demo.data[1].environment).toBe('test');
    expect(demo.data[1].yes).toBe(1);
    expect(demo.data[1].no).toBe(3);

    expect(t2.data).toHaveLength(1);
    expect(t2.data[0].environment).toBe('default');
    expect(t2.data[0].yes).toBe(7);
    expect(t2.data[0].no).toBe(104);
});

test('should return toggle summary', async () => {
    const date = new Date();
    const metrics: IClientMetricsEnv[] = [
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 2,
            no: 2,
        },
        {
            featureName: 't2',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 5,
            no: 5,
        },
        {
            featureName: 't2',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 2,
            no: 99,
        },
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 3,
            no: 2,
        },
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'test',
            timestamp: date,
            yes: 1,
            no: 3,
        },
        {
            featureName: 'demo',
            appName: 'backend-api',
            environment: 'test',
            timestamp: date,
            yes: 1,
            no: 3,
        },
    ];

    await db.stores.clientMetricsStoreV2.batchInsertMetrics(metrics);

    const { body: demo } = await app.request
        .get('/api/admin/client-metrics/features/demo')
        .expect('Content-Type', /json/)
        .expect(200);

    expect(demo.featureName).toBe('demo');
    expect(demo.lastHourUsage).toHaveLength(2);
    expect(demo.lastHourUsage[0].environment).toBe('default');
    expect(demo.lastHourUsage[0].yes).toBe(5);
    expect(demo.lastHourUsage[0].no).toBe(4);
    expect(demo.lastHourUsage[1].environment).toBe('test');
    expect(demo.lastHourUsage[1].yes).toBe(2);
    expect(demo.lastHourUsage[1].no).toBe(6);
    expect(demo.seenApplications).toStrictEqual(['backend-api', 'web']);
});

test('should only include last hour of metrics return toggle summary', async () => {
    const date = new Date();
    const dateHoneHourAgo = new Date();
    dateHoneHourAgo.setHours(-1);
    const metrics: IClientMetricsEnv[] = [
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 2,
            no: 2,
        },
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'default',
            timestamp: date,
            yes: 3,
            no: 2,
        },
        {
            featureName: 'demo',
            appName: 'web',
            environment: 'test',
            timestamp: date,
            yes: 1,
            no: 3,
        },
        {
            featureName: 'demo',
            appName: 'backend-api',
            environment: 'test',
            timestamp: date,
            yes: 1,
            no: 3,
        },
        {
            featureName: 'demo',
            appName: 'backend-api',
            environment: 'test',
            timestamp: dateHoneHourAgo,
            yes: 55,
            no: 55,
        },
    ];

    await db.stores.clientMetricsStoreV2.batchInsertMetrics(metrics);

    const { body: demo } = await app.request
        .get('/api/admin/client-metrics/features/demo')
        .expect('Content-Type', /json/)
        .expect(200);

    expect(demo.featureName).toBe('demo');
    expect(demo.lastHourUsage).toHaveLength(2);
    expect(demo.lastHourUsage[0].environment).toBe('default');
    expect(demo.lastHourUsage[0].yes).toBe(5);
    expect(demo.lastHourUsage[0].no).toBe(4);
    expect(demo.lastHourUsage[1].environment).toBe('test');
    expect(demo.lastHourUsage[1].yes).toBe(2);
    expect(demo.lastHourUsage[1].no).toBe(6);
    expect(demo.seenApplications).toStrictEqual(['backend-api', 'web']);
});
