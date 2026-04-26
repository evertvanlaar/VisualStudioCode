import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'function-filter-body.js'), 'utf8');

/**
 * Set-node laat sheetkolommen soms vallen (Include Other Fields). Code merge is expliciet en robuust.
 * Webhook-naam moet exact overeenkomen met de Webhook-node in deze workflow.
 */
const attachBusQueryJs = `const q = $('Webhook (GET) bus-schedule').first().json.query || {};
return $input.all().map((item) => ({
  json: {
    ...item.json,
    _busQuery: q,
  },
}));`;

const attachRequestQueryNode = {
  parameters: {
    language: 'javaScript',
    mode: 'runOnceForAllItems',
    jsCode: attachBusQueryJs,
  },
  name: 'Attach request query',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-152, 80],
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};

const wf = {
  nodes: [
    {
      parameters: { path: 'bus-schedule', responseMode: 'responseNode', options: {} },
      name: 'Webhook (GET) bus-schedule',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [-496, 80],
      id: '2bc5c0f1-8059-46e3-a250-d8dcc7045d68',
      webhookId: 'd84a6904-9e22-43d6-b4e5-6cc21458c5ef',
    },
    {
      parameters: {
        documentId: {
          __rl: true,
          value: '1DGtUvOvJ35MzXsZBZOPR1xzkyb0V_sMttOKcv1JBuig',
          mode: 'list',
          cachedResultName: 'localbusinesses-kalanera',
          cachedResultUrl:
            'https://docs.google.com/spreadsheets/d/1DGtUvOvJ35MzXsZBZOPR1xzkyb0V_sMttOKcv1JBuig/edit?usp=drivesdk',
        },
        sheetName: {
          __rl: true,
          value: 681885468,
          mode: 'list',
          cachedResultName: 'Bus_Schedule',
          cachedResultUrl:
            'https://docs.google.com/spreadsheets/d/1DGtUvOvJ35MzXsZBZOPR1xzkyb0V_sMttOKcv1JBuig/edit#gid=681885468',
        },
        options: {},
      },
      name: 'Read Google Sheet (Bus_Schedule)',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 3,
      position: [-272, 80],
      id: '6f5914d0-0f9a-4bf9-bf41-a32f5c98ba01',
      credentials: {
        googleSheetsOAuth2Api: { id: 'dt65031NC2CKh6xA', name: 'Google Sheets account' },
      },
    },
    attachRequestQueryNode,
    {
      parameters: { functionCode: code },
      name: 'Filter + Normalize + Sort (Athens)',
      type: 'n8n-nodes-base.function',
      typeVersion: 1,
      position: [32, 80],
      id: 'a4db2d6d-6cb2-4e33-a06d-5e5cd3f02c59',
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{$json}}',
        options: {
          responseHeaders: {
            entries: [
              { name: 'Content-Type', value: 'application/json; charset=utf-8' },
              { name: 'Access-Control-Allow-Origin', value: '*' },
              { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
              { name: 'Access-Control-Allow-Headers', value: 'Content-Type, X-API-Key' },
              { name: 'Cache-Control', value: 'public, max-age=60' },
            ],
          },
        },
      },
      name: 'Respond (JSON + CORS)',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [224, 80],
      id: '343b849d-5b4e-451a-b66c-e2426b652632',
    },
  ],
  connections: {
    'Webhook (GET) bus-schedule': {
      main: [[{ node: 'Read Google Sheet (Bus_Schedule)', type: 'main', index: 0 }]],
    },
    'Read Google Sheet (Bus_Schedule)': {
      main: [[{ node: 'Attach request query', type: 'main', index: 0 }]],
    },
    'Attach request query': {
      main: [[{ node: 'Filter + Normalize + Sort (Athens)', type: 'main', index: 0 }]],
    },
    'Filter + Normalize + Sort (Athens)': {
      main: [[{ node: 'Respond (JSON + CORS)', type: 'main', index: 0 }]],
    },
  },
  pinData: {},
  meta: {
    templateCredsSetupCompleted: true,
    instanceId: '8a056dda650f196038a1bda699419085e220ce6f0fa9607c4ea76c82ef8a8dd1',
  },
};

fs.writeFileSync(path.join(__dirname, 'bus-schedule-workflow.json'), JSON.stringify(wf, null, 2), 'utf8');
console.log('Wrote bus-schedule-workflow.json');
