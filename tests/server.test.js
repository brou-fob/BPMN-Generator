'use strict';

const request = require('supertest');
const app = require('../src/server');

const VALID_BODY = {
  name: 'API Test Process',
  elements: [
    { id: 'start1', type: 'startEvent', name: 'Start' },
    { id: 'task1', type: 'task', name: 'Work' },
    { id: 'end1', type: 'endEvent', name: 'End' },
  ],
  flows: [
    { id: 'flow1', source: 'start1', target: 'task1' },
    { id: 'flow2', source: 'task1', target: 'end1' },
  ],
};

describe('POST /api/generate', () => {
  test('returns 200 and XML for valid input', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send(VALID_BODY)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toMatch(/^<\?xml/);
    expect(res.text).toContain('<bpmn:definitions');
    expect(res.text).toContain('API Test Process');
  });

  test('returns 400 with error message for invalid input', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ name: 'Bad Process', elements: [], flows: [] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when elements field is missing', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ name: 'Incomplete' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/elements/i);
  });

  test('returns 400 when flow references unknown element', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({
        name: 'Bad Flows',
        elements: [
          { id: 'start1', type: 'startEvent', name: 'Start' },
          { id: 'end1', type: 'endEvent', name: 'End' },
        ],
        flows: [{ id: 'flow1', source: 'start1', target: 'missing' }],
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown target/i);
  });
});

describe('POST /api/change-type', () => {
  test('returns updated process data with the element type changed', async () => {
    const res = await request(app)
      .post('/api/change-type')
      .send({ data: VALID_BODY, elementId: 'task1', newType: 'userTask' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const updated = res.body;
    const el = updated.elements.find((e) => e.id === 'task1');
    expect(el.type).toBe('userTask');
  });

  test('returns 400 for unknown newType', async () => {
    const res = await request(app)
      .post('/api/change-type')
      .send({ data: VALID_BODY, elementId: 'task1', newType: 'badType' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Unknown type/i);
  });

  test('returns 400 when elementId is not found', async () => {
    const res = await request(app)
      .post('/api/change-type')
      .send({ data: VALID_BODY, elementId: 'nonexistent', newType: 'task' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 400 when data is invalid', async () => {
    const res = await request(app)
      .post('/api/change-type')
      .send({ data: { name: 'Bad', elements: [], flows: [] }, elementId: 'x', newType: 'task' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
