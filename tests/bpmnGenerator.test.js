'use strict';

const { generate, validate, ELEMENT_TYPES } = require('../src/bpmnGenerator');

const MINIMAL_DATA = {
  name: 'Test Process',
  elements: [
    { id: 'start1', type: 'startEvent', name: 'Start' },
    { id: 'task1', type: 'task', name: 'Do Something' },
    { id: 'end1', type: 'endEvent', name: 'End' },
  ],
  flows: [
    { id: 'flow1', source: 'start1', target: 'task1' },
    { id: 'flow2', source: 'task1', target: 'end1' },
  ],
};

describe('validate()', () => {
  test('accepts a valid minimal process definition', () => {
    expect(() => validate(MINIMAL_DATA)).not.toThrow();
  });

  test('throws if data is null', () => {
    expect(() => validate(null)).toThrow('Input data must be a JSON object.');
  });

  test('throws if name is missing', () => {
    const data = { ...MINIMAL_DATA, name: undefined };
    expect(() => validate(data)).toThrow('"name" is required');
  });

  test('throws if elements is empty', () => {
    const data = { ...MINIMAL_DATA, elements: [] };
    expect(() => validate(data)).toThrow('"elements" is required and must be a non-empty array');
  });

  test('throws if flows is not an array', () => {
    const data = { ...MINIMAL_DATA, flows: null };
    expect(() => validate(data)).toThrow('"flows" is required and must be an array');
  });

  test('throws on unknown element type', () => {
    const data = {
      ...MINIMAL_DATA,
      elements: [{ id: 'x1', type: 'unknownType', name: 'X' }, ...MINIMAL_DATA.elements.slice(1)],
    };
    expect(() => validate(data)).toThrow('unknown type');
  });

  test('throws on duplicate element id', () => {
    const data = {
      ...MINIMAL_DATA,
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start' },
        { id: 'start1', type: 'task', name: 'Duplicate' },
        { id: 'end1', type: 'endEvent', name: 'End' },
      ],
    };
    expect(() => validate(data)).toThrow('Duplicate element id');
  });

  test('throws if flow references unknown source', () => {
    const data = {
      ...MINIMAL_DATA,
      flows: [{ id: 'flow1', source: 'nonexistent', target: 'task1' }],
    };
    expect(() => validate(data)).toThrow('unknown source');
  });

  test('throws if flow references unknown target', () => {
    const data = {
      ...MINIMAL_DATA,
      flows: [{ id: 'flow1', source: 'start1', target: 'nonexistent' }],
    };
    expect(() => validate(data)).toThrow('unknown target');
  });

  test('throws on duplicate flow id', () => {
    const data = {
      ...MINIMAL_DATA,
      flows: [
        { id: 'flow1', source: 'start1', target: 'task1' },
        { id: 'flow1', source: 'task1', target: 'end1' },
      ],
    };
    expect(() => validate(data)).toThrow('Duplicate flow id');
  });
});

describe('generate()', () => {
  test('returns a string', () => {
    expect(typeof generate(MINIMAL_DATA)).toBe('string');
  });

  test('output starts with XML declaration', () => {
    expect(generate(MINIMAL_DATA)).toMatch(/^<\?xml version="1\.0"/);
  });

  test('output contains bpmn:definitions root element', () => {
    expect(generate(MINIMAL_DATA)).toContain('<bpmn:definitions');
  });

  test('output contains process name', () => {
    expect(generate(MINIMAL_DATA)).toContain('name="Test Process"');
  });

  test('output contains all element ids', () => {
    const xml = generate(MINIMAL_DATA);
    expect(xml).toContain('id="start1"');
    expect(xml).toContain('id="task1"');
    expect(xml).toContain('id="end1"');
  });

  test('output contains sequence flows', () => {
    const xml = generate(MINIMAL_DATA);
    expect(xml).toContain('bpmn:sequenceFlow');
    expect(xml).toContain('id="flow1"');
    expect(xml).toContain('id="flow2"');
  });

  test('output contains BPMNDiagram section', () => {
    expect(generate(MINIMAL_DATA)).toContain('<bpmndi:BPMNDiagram');
  });

  test('output contains BPMNShape for each element', () => {
    const xml = generate(MINIMAL_DATA);
    expect(xml).toContain('id="start1_di"');
    expect(xml).toContain('id="task1_di"');
    expect(xml).toContain('id="end1_di"');
  });

  test('output contains BPMNEdge for each flow', () => {
    const xml = generate(MINIMAL_DATA);
    expect(xml).toContain('id="flow1_di"');
    expect(xml).toContain('id="flow2_di"');
  });

  test('escapes XML special characters in names', () => {
    const data = {
      name: 'Process <Test> & "More"',
      elements: [
        { id: 'start1', type: 'startEvent', name: 'A & B' },
        { id: 'end1', type: 'endEvent', name: 'Done' },
      ],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('name="Process &lt;Test&gt; &amp; &quot;More&quot;"');
    expect(xml).toContain('name="A &amp; B"');
  });

  test('supports all gateway types', () => {
    const data = {
      name: 'Gateway Process',
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start' },
        { id: 'gw1', type: 'exclusiveGateway', name: 'XOR' },
        { id: 'gw2', type: 'parallelGateway', name: 'AND' },
        { id: 'gw3', type: 'inclusiveGateway', name: 'OR' },
        { id: 'end1', type: 'endEvent', name: 'End' },
      ],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('bpmn:exclusiveGateway');
    expect(xml).toContain('bpmn:parallelGateway');
    expect(xml).toContain('bpmn:inclusiveGateway');
  });

  test('flow names appear in sequence flow attributes', () => {
    const data = {
      name: 'Named Flow Process',
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start' },
        { id: 'end1', type: 'endEvent', name: 'End' },
      ],
      flows: [{ id: 'flow1', source: 'start1', target: 'end1', name: 'Go' }],
    };
    const xml = generate(data);
    expect(xml).toContain('name="Go"');
  });

  test('throws on invalid input (passed through from validate)', () => {
    expect(() => generate({ name: 'X', elements: [], flows: [] })).toThrow();
  });

  test('ELEMENT_TYPES exports all supported types', () => {
    const expected = [
      'startEvent', 'endEvent', 'task', 'userTask', 'serviceTask',
      'exclusiveGateway', 'parallelGateway', 'inclusiveGateway',
    ];
    expected.forEach((t) => expect(ELEMENT_TYPES).toHaveProperty(t));
  });
});
