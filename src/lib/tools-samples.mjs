/**
 * Sample input presets for OpenAPI to JMX and JMX Linter tools.
 * Extracted from tools-config.mjs to keep module sizes well under 500 lines.
 */

export const OPENAPI_SAMPLES = {
  petstoreJson: JSON.stringify(
    {
      openapi: '3.0.3',
      info: { title: 'Petstore API', version: '1.0.0' },
      servers: [
        {
          url: 'https://petstore.example.com/{basePath}',
          variables: { basePath: { default: 'v3' } },
        },
      ],
      tags: [{ name: 'pet' }, { name: 'store' }],
      security: [{ bearerAuth: [] }],
      paths: {
        '/pet/{petId}': {
          get: {
            tags: ['pet'],
            operationId: 'getPetById',
            summary: 'Find pet by ID',
            parameters: [
              {
                name: 'petId',
                in: 'path',
                required: true,
                example: 10,
                schema: { type: 'integer', format: 'int64' },
              },
            ],
            responses: { 200: { description: 'Pet response' } },
          },
          delete: {
            tags: ['pet'],
            operationId: 'deletePet',
            deprecated: true,
            parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } }],
            responses: { 204: { description: 'Deleted' } },
          },
        },
        '/pet': {
          post: {
            tags: ['pet'],
            operationId: 'addPet',
            requestBody: {
              required: true,
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Pet' } },
              },
            },
            responses: { 201: { description: 'Created' } },
          },
        },
        '/pet/findByStatus': {
          get: {
            tags: ['pet'],
            operationId: 'findPetsByStatus',
            parameters: [
              {
                name: 'status',
                in: 'query',
                required: false,
                schema: { type: 'string', enum: ['available', 'pending', 'sold'] },
              },
            ],
            responses: { 200: { description: 'Pets' } },
          },
        },
        '/store/inventory': {
          get: {
            tags: ['store'],
            operationId: 'getInventory',
            security: [],
            responses: { 200: { description: 'Inventory' } },
          },
        },
        '/store/order': {
          post: {
            tags: ['store'],
            operationId: 'placeOrder',
            requestBody: {
              content: {
                'application/x-www-form-urlencoded': {
                  schema: {
                    type: 'object',
                    properties: {
                      petId: { type: 'integer', example: 10 },
                      quantity: { type: 'integer', default: 1 },
                    },
                  },
                },
              },
            },
            responses: { 201: { description: 'Order placed' } },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: {
          BasePet: {
            type: 'object',
            required: ['name', 'status'],
            properties: {
              name: { type: 'string', example: 'Fido' },
              status: { type: 'string', enum: ['available', 'pending', 'sold'] },
            },
          },
          Tag: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string', example: 'friendly' },
            },
          },
          Pet: {
            allOf: [
              { $ref: '#/components/schemas/BasePet' },
              {
                type: 'object',
                properties: {
                  tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
                },
              },
            ],
          },
        },
      },
    },
    null,
    2,
  ),
  minimalYaml: `openapi: 3.1.0
info:
  title: Users API
  version: 1.0.0
servers:
  - url: https://users.example.com/v1
security:
  - apiKeyAuth: []
paths:
  /users:
    get:
      operationId: listUsers
      parameters:
        - name: page
          in: query
          required: false
          schema: { type: integer, default: 1 }
      responses:
        '200': { description: Users }
    post:
      operationId: createUser
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, email]
              properties:
                name: { type: string, example: Ada }
                email: { type: string, format: email }
      responses:
        '201': { description: Created }
  /users/{userId}:
    get:
      operationId: getUser
      parameters:
        - name: userId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200': { description: User }
components:
  securitySchemes:
    apiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key`,
  swagger2Json: JSON.stringify(
    {
      swagger: '2.0',
      info: { title: 'Legacy Orders API', version: '1.0.0' },
      host: 'legacy.example.com',
      basePath: '/api/v2',
      schemes: ['https'],
      consumes: ['application/json'],
      paths: {
        '/orders': {
          get: {
            operationId: 'listOrders',
            parameters: [
              { name: 'limit', in: 'query', required: true, type: 'integer', default: 20 },
            ],
            responses: { 200: { description: 'Orders' } },
          },
          post: {
            operationId: 'createOrder',
            parameters: [
              {
                name: 'body',
                in: 'body',
                required: true,
                schema: { $ref: '#/definitions/Order' },
              },
            ],
            responses: { 201: { description: 'Created' } },
          },
        },
      },
      definitions: {
        Order: {
          type: 'object',
          required: ['sku'],
          properties: {
            sku: { type: 'string', example: 'SKU-100' },
            quantity: { type: 'integer', minimum: 2 },
          },
        },
      },
    },
    null,
    2,
  ),
};

export const JMX_LINTER_SAMPLES = {
  antiPatterns: `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Anti-Pattern Demo" enabled="true"/>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Instant Load" enabled="true">
        <stringProp name="ThreadGroup.num_threads">200</stringProp>
        <stringProp name="ThreadGroup.ramp_time">0</stringProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">1</stringProp>
        </elementProp>
      </ThreadGroup>
      <hashTree>
        <BeanShellPreProcessor guiclass="TestBeanGUI" testclass="BeanShellPreProcessor" testname="Legacy setup" enabled="true"/>
        <hashTree/>
        <JSR223Sampler guiclass="TestBeanGUI" testclass="JSR223Sampler" testname="Blocking script" enabled="true">
          <stringProp name="scriptLanguage">groovy</stringProp>
          <stringProp name="cacheKey"></stringProp>
          <stringProp name="script">Thread.sleep(500)</stringProp>
        </JSR223Sampler>
        <hashTree/>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="Request without timeouts" enabled="true">
          <stringProp name="HTTPSampler.domain">example.com</stringProp>
          <stringProp name="HTTPSampler.path">/api/items</stringProp>
          <stringProp name="HTTPSampler.implementation">Java</stringProp>
        </HTTPSamplerProxy>
        <hashTree/>
        <ResultCollector guiclass="ViewResultsFullVisualizer" testclass="ResultCollector" testname="View Results Tree" enabled="true"/>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`,
  clean: `<?xml version="1.0" encoding="UTF-8"?>
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Healthy API Plan" enabled="true"/>
    <hashTree>
      <ConfigTestElement guiclass="HttpDefaultsGui" testclass="ConfigTestElement" testname="HTTP Request Defaults" enabled="true">
        <stringProp name="HTTPSampler.connect_timeout">5000</stringProp>
        <stringProp name="HTTPSampler.response_timeout">30000</stringProp>
      </ConfigTestElement>
      <hashTree/>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="API Users" enabled="true">
        <stringProp name="ThreadGroup.num_threads">100</stringProp>
        <stringProp name="ThreadGroup.ramp_time">60</stringProp>
        <boolProp name="ThreadGroup.scheduler">false</boolProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController" guiclass="LoopControlPanel" testclass="LoopController" testname="Loop Controller" enabled="true">
          <boolProp name="LoopController.continue_forever">false</boolProp>
          <stringProp name="LoopController.loops">1</stringProp>
        </elementProp>
      </ThreadGroup>
      <hashTree>
        <JSR223Sampler guiclass="TestBeanGUI" testclass="JSR223Sampler" testname="Prepared script" enabled="true">
          <stringProp name="scriptLanguage">groovy</stringProp>
          <boolProp name="cacheKey">true</boolProp>
          <stringProp name="script">vars.put(&quot;ready&quot;, &quot;true&quot;)</stringProp>
        </JSR223Sampler>
        <hashTree/>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="GET items" enabled="true">
          <stringProp name="HTTPSampler.domain">example.com</stringProp>
          <stringProp name="HTTPSampler.path">/api/items</stringProp>
          <stringProp name="HTTPSampler.implementation">HttpClient4</stringProp>
        </HTTPSamplerProxy>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>`,
};
