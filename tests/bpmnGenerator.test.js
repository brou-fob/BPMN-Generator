'use strict';

const { generate, validate, changeElementType, insertMergeGateways, ELEMENT_TYPES } = require('../src/bpmnGenerator');

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

describe('changeElementType()', () => {
  test('changes the type of an existing element', () => {
    const updated = changeElementType(MINIMAL_DATA, 'task1', 'userTask');
    const el = updated.elements.find((e) => e.id === 'task1');
    expect(el.type).toBe('userTask');
  });

  test('returns a new object without mutating the original', () => {
    const updated = changeElementType(MINIMAL_DATA, 'task1', 'serviceTask');
    expect(updated).not.toBe(MINIMAL_DATA);
    const original = MINIMAL_DATA.elements.find((e) => e.id === 'task1');
    expect(original.type).toBe('task');
  });

  test('preserves all other element properties', () => {
    const updated = changeElementType(MINIMAL_DATA, 'task1', 'userTask');
    const el = updated.elements.find((e) => e.id === 'task1');
    expect(el.id).toBe('task1');
    expect(el.name).toBe('Do Something');
  });

  test('preserves other elements unchanged', () => {
    const updated = changeElementType(MINIMAL_DATA, 'task1', 'userTask');
    const start = updated.elements.find((e) => e.id === 'start1');
    expect(start.type).toBe('startEvent');
  });

  test('throws on unknown newType', () => {
    expect(() => changeElementType(MINIMAL_DATA, 'task1', 'unknownType')).toThrow('Unknown type');
  });

  test('throws when elementId is not found', () => {
    expect(() => changeElementType(MINIMAL_DATA, 'nonexistent', 'task')).toThrow('not found');
  });

  test('throws if underlying data is invalid', () => {
    expect(() => changeElementType(null, 'task1', 'task')).toThrow();
  });

  test('generated XML uses the new type after change', () => {
    const updated = changeElementType(MINIMAL_DATA, 'task1', 'userTask');
    const xml = generate(updated);
    expect(xml).toContain('bpmn:userTask');
    expect(xml).not.toMatch(/bpmn:task[\s\/>]/);
  });
});

// ---------------------------------------------------------------------------
// Custom element positions (x, y overrides)
// ---------------------------------------------------------------------------

describe('custom element positions', () => {
  /**
   * Helper: extract dc:Bounds x and y for a given element id from BPMN XML.
   */
  function getShapeBoundsXY(xml, elementId) {
    const re = new RegExp(
      `id="${elementId}_di"[\\s\\S]*?<dc:Bounds[^>]*x="([^"]+)"[^>]*y="([^"]+)"`
    );
    const m = xml.match(re);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
  }

  test('elements with x and y fields use those coordinates in the output', () => {
    const data = {
      name: 'Custom Pos',
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start', x: 50,  y: 100 },
        { id: 'end1',   type: 'endEvent',   name: 'End',   x: 400, y: 100 },
      ],
      flows: [{ id: 'flow1', source: 'start1', target: 'end1' }],
    };
    const xml = generate(data);
    const startBounds = getShapeBoundsXY(xml, 'start1');
    const endBounds   = getShapeBoundsXY(xml, 'end1');
    expect(startBounds).not.toBeNull();
    expect(endBounds).not.toBeNull();
    expect(startBounds.x).toBe(50);
    expect(startBounds.y).toBe(100);
    expect(endBounds.x).toBe(400);
    expect(endBounds.y).toBe(100);
  });

  test('elements without x and y fall back to auto-layout', () => {
    // MINIMAL_DATA has no x/y on elements → auto-layout is used
    const xml = generate(MINIMAL_DATA);
    const bounds = getShapeBoundsXY(xml, 'start1');
    expect(bounds).not.toBeNull();
    // Auto-layout startX is 150 for the first element
    expect(bounds.x).toBe(150);
  });

  test('mix: elements with x/y override only those positions', () => {
    const data = {
      name: 'Mix Pos',
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start', x: 50, y: 200 },
        { id: 'task1',  type: 'task',       name: 'Task' },  // no x/y → auto-layout
        { id: 'end1',   type: 'endEvent',   name: 'End',  x: 600, y: 200 },
      ],
      flows: [
        { id: 'flow1', source: 'start1', target: 'task1' },
        { id: 'flow2', source: 'task1',  target: 'end1'  },
      ],
    };
    const xml = generate(data);
    const startBounds = getShapeBoundsXY(xml, 'start1');
    const endBounds   = getShapeBoundsXY(xml, 'end1');
    expect(startBounds.x).toBe(50);
    expect(startBounds.y).toBe(200);
    expect(endBounds.x).toBe(600);
    expect(endBounds.y).toBe(200);
  });
});

/**
 * Helper: extract the dc:Bounds y value for a given element id from BPMN XML.
 */
function getShapeY(xml, elementId) {
  const re = new RegExp(
    `id="${elementId}_di"[\\s\\S]*?<dc:Bounds[^>]*y="([^"]+)"`
  );
  const m = xml.match(re);
  return m ? parseFloat(m[1]) : null;
}

describe('parallel flow layout', () => {
  const PARALLEL_DATA = {
    name: 'Parallel Process',
    elements: [
      { id: 'start1', type: 'startEvent', name: 'Start' },
      { id: 'gw1', type: 'parallelGateway', name: 'Split' },
      { id: 'taskA', type: 'task', name: 'Task A' },
      { id: 'taskB', type: 'task', name: 'Task B' },
      { id: 'gw2', type: 'parallelGateway', name: 'Join' },
      { id: 'end1', type: 'endEvent', name: 'End' },
    ],
    flows: [
      { id: 'f1', source: 'start1', target: 'gw1' },
      { id: 'f2', source: 'gw1', target: 'taskA' },
      { id: 'f3', source: 'gw1', target: 'taskB' },
      { id: 'f4', source: 'taskA', target: 'gw2' },
      { id: 'f5', source: 'taskB', target: 'gw2' },
      { id: 'f6', source: 'gw2', target: 'end1' },
    ],
  };

  test('parallel branch tasks are placed at different Y coordinates', () => {
    const xml = generate(PARALLEL_DATA);
    const yA = getShapeY(xml, 'taskA');
    const yB = getShapeY(xml, 'taskB');
    expect(yA).not.toBeNull();
    expect(yB).not.toBeNull();
    expect(yA).not.toBe(yB);
  });

  test('join gateway is not placed at a branch-only Y position', () => {
    const xml = generate(PARALLEL_DATA);
    const yA = getShapeY(xml, 'taskA');
    const yB = getShapeY(xml, 'taskB');
    const yJoin = getShapeY(xml, 'gw2');
    expect(yJoin).not.toBeNull();
    // Join gateway must differ from both branch task Y positions
    expect(yJoin).not.toBe(yA);
    expect(yJoin).not.toBe(yB);
  });

  test('three parallel branches are each placed at distinct Y coordinates', () => {
    const data = {
      name: 'Three Branch Process',
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start' },
        { id: 'gw1', type: 'parallelGateway', name: 'Split' },
        { id: 'taskA', type: 'task', name: 'Task A' },
        { id: 'taskB', type: 'task', name: 'Task B' },
        { id: 'taskC', type: 'task', name: 'Task C' },
        { id: 'gw2', type: 'parallelGateway', name: 'Join' },
        { id: 'end1', type: 'endEvent', name: 'End' },
      ],
      flows: [
        { id: 'f1', source: 'start1', target: 'gw1' },
        { id: 'f2', source: 'gw1', target: 'taskA' },
        { id: 'f3', source: 'gw1', target: 'taskB' },
        { id: 'f4', source: 'gw1', target: 'taskC' },
        { id: 'f5', source: 'taskA', target: 'gw2' },
        { id: 'f6', source: 'taskB', target: 'gw2' },
        { id: 'f7', source: 'taskC', target: 'gw2' },
        { id: 'f8', source: 'gw2', target: 'end1' },
      ],
    };
    const xml = generate(data);
    const yA = getShapeY(xml, 'taskA');
    const yB = getShapeY(xml, 'taskB');
    const yC = getShapeY(xml, 'taskC');
    expect(new Set([yA, yB, yC]).size).toBe(3);
  });

  test('sequential elements without parallel branches keep same Y coordinate', () => {
    const xml = generate(MINIMAL_DATA);
    const yStart = getShapeY(xml, 'start1');
    const yTask = getShapeY(xml, 'task1');
    const yEnd = getShapeY(xml, 'end1');
    // All on the same row (row 0), so their centre Y equals LAYOUT.startY (250).
    // Just verify they are all equal (no vertical spreading for linear flows)
    expect(yStart).not.toBeNull();
    expect(yTask).not.toBeNull();
    expect(yEnd).not.toBeNull();
    // All sequential elements share row 0; compute their vertical centres.
    // LAYOUT.eventSize = 36, LAYOUT.elementHeight = 80
    const centreStart = yStart + 36 / 2; // startEvent height / 2
    const centreTask = yTask + 80 / 2;   // task height / 2
    const centreEnd = yEnd + 36 / 2;     // endEvent height / 2
    expect(centreStart).toBe(centreTask);
    expect(centreTask).toBe(centreEnd);
  });
});

describe('intermediate and boundary events', () => {
  const INTERMEDIATE_DATA = {
    name: 'Intermediate Event Process',
    elements: [
      { id: 'start1', type: 'startEvent', name: 'Start' },
      { id: 'timer1', type: 'intermediateTimerEvent', name: 'Warten' },
      { id: 'end1', type: 'endEvent', name: 'Ende' },
    ],
    flows: [
      { id: 'f1', source: 'start1', target: 'timer1' },
      { id: 'f2', source: 'timer1', target: 'end1' },
    ],
  };

  test('intermediateTimerEvent generates intermediateCatchEvent with timerEventDefinition', () => {
    const xml = generate(INTERMEDIATE_DATA);
    expect(xml).toContain('<bpmn:intermediateCatchEvent id="timer1"');
    expect(xml).toContain('<bpmn:timerEventDefinition />');
    expect(xml).toContain('</bpmn:intermediateCatchEvent>');
  });

  test('intermediateMessageEvent generates intermediateCatchEvent with messageEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateMessageEvent', name: 'Msg' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:intermediateCatchEvent id="e1"');
    expect(xml).toContain('<bpmn:messageEventDefinition />');
  });

  test('intermediateSignalEvent generates intermediateCatchEvent with signalEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateSignalEvent', name: 'Sig' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:signalEventDefinition />');
  });

  test('intermediateConditionalEvent generates intermediateCatchEvent with conditionalEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateConditionalEvent', name: 'Cond' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:conditionalEventDefinition />');
  });

  test('intermediateThrowEvent generates intermediateThrowEvent without event definition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateThrowEvent', name: 'Throw' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:intermediateThrowEvent id="e1"');
    expect(xml).not.toContain('<bpmn:timerEventDefinition');
  });

  test('intermediateMessageThrowEvent generates intermediateThrowEvent with messageEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateMessageThrowEvent', name: 'MsgThrow' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:intermediateThrowEvent id="e1"');
    expect(xml).toContain('<bpmn:messageEventDefinition />');
  });

  test('intermediateSignalThrowEvent generates intermediateThrowEvent with signalEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateSignalThrowEvent', name: 'SigThrow' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:signalEventDefinition />');
  });

  test('intermediateEscalationEvent generates intermediateThrowEvent with escalationEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateEscalationEvent', name: 'Esc' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:escalationEventDefinition />');
  });

  test('intermediateLinkEvent generates intermediateThrowEvent with linkEventDefinition', () => {
    const data = {
      name: 'P', elements: [{ id: 'e1', type: 'intermediateLinkEvent', name: 'Link' }], flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:linkEventDefinition />');
  });

  test('boundaryTimerEvent generates boundaryEvent with timerEventDefinition and attachedToRef', () => {
    const data = {
      name: 'P',
      elements: [
        { id: 'task1', type: 'task', name: 'Task' },
        { id: 'b1', type: 'boundaryTimerEvent', name: 'Timeout', attachedToRef: 'task1' },
      ],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:boundaryEvent id="b1"');
    expect(xml).toContain('attachedToRef="task1"');
    expect(xml).toContain('<bpmn:timerEventDefinition />');
    expect(xml).toContain('</bpmn:boundaryEvent>');
  });

  test('boundaryErrorEvent generates boundaryEvent with errorEventDefinition', () => {
    const data = {
      name: 'P',
      elements: [
        { id: 'task1', type: 'task', name: 'Task' },
        { id: 'b1', type: 'boundaryErrorEvent', name: 'Error', attachedToRef: 'task1' },
      ],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:errorEventDefinition />');
  });

  test('boundaryMessageEvent generates boundaryEvent with messageEventDefinition', () => {
    const data = {
      name: 'P',
      elements: [
        { id: 'task1', type: 'task', name: 'Task' },
        { id: 'b1', type: 'boundaryMessageEvent', name: 'Msg', attachedToRef: 'task1' },
      ],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:messageEventDefinition />');
  });

  test('boundarySignalEvent generates boundaryEvent with signalEventDefinition', () => {
    const data = {
      name: 'P',
      elements: [
        { id: 'task1', type: 'task', name: 'Task' },
        { id: 'b1', type: 'boundarySignalEvent', name: 'Sig', attachedToRef: 'task1' },
      ],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('<bpmn:signalEventDefinition />');
  });

  test('validate throws when boundaryEvent is missing attachedToRef', () => {
    const data = {
      name: 'P',
      elements: [
        { id: 'task1', type: 'task', name: 'Task' },
        { id: 'b1', type: 'boundaryTimerEvent', name: 'Timeout' },
      ],
      flows: [],
    };
    expect(() => validate(data)).toThrow('attachedToRef');
  });

  test('validate throws when boundaryEvent attachedToRef references unknown element', () => {
    const data = {
      name: 'P',
      elements: [
        { id: 'b1', type: 'boundaryTimerEvent', name: 'Timeout', attachedToRef: 'nonexistent' },
      ],
      flows: [],
    };
    expect(() => validate(data)).toThrow('attachedToRef');
  });

  test('intermediate events use eventSize in layout', () => {
    const xml = generate(INTERMEDIATE_DATA);
    // eventSize is 36, so width and height for timer event should be 36
    const re = /id="timer1_di"[\s\S]*?<dc:Bounds[^>]*width="([^"]+)"/;
    const m = xml.match(re);
    expect(m).not.toBeNull();
    expect(parseFloat(m[1])).toBe(36);
  });

  test('ELEMENT_TYPES exports all new intermediate and boundary event types', () => {
    const newTypes = [
      'intermediateTimerEvent', 'intermediateMessageEvent', 'intermediateSignalEvent',
      'intermediateConditionalEvent', 'intermediateThrowEvent', 'intermediateMessageThrowEvent',
      'intermediateSignalThrowEvent', 'intermediateEscalationEvent', 'intermediateLinkEvent',
      'boundaryTimerEvent', 'boundaryErrorEvent', 'boundaryMessageEvent', 'boundarySignalEvent',
    ];
    newTypes.forEach((t) => expect(ELEMENT_TYPES).toHaveProperty(t));
  });
});

// ---------------------------------------------------------------------------
// Pools and Lanes
// ---------------------------------------------------------------------------

const POOL_DATA = {
  name: 'Order Process',
  pools: [
    {
      id: 'pool1',
      name: 'Customer',
      lanes: [
        { id: 'lane1', name: 'Sales' },
        { id: 'lane2', name: 'Operations' },
      ],
    },
  ],
  elements: [
    { id: 'start1', type: 'startEvent',  name: 'Start',  laneRef: 'lane1' },
    { id: 'task1',  type: 'task',        name: 'Task A', laneRef: 'lane1' },
    { id: 'task2',  type: 'task',        name: 'Task B', laneRef: 'lane2' },
    { id: 'end1',   type: 'endEvent',    name: 'End',    laneRef: 'lane2' },
  ],
  flows: [
    { id: 'f1', source: 'start1', target: 'task1' },
    { id: 'f2', source: 'task1',  target: 'task2' },
    { id: 'f3', source: 'task2',  target: 'end1'  },
  ],
};

describe('validate() – pools and lanes', () => {
  test('accepts valid pool/lane data', () => {
    expect(() => validate(POOL_DATA)).not.toThrow();
  });

  test('accepts data without pools field (unchanged behaviour)', () => {
    expect(() => validate(MINIMAL_DATA)).not.toThrow();
  });

  test('throws when pools is not an array', () => {
    const data = { ...POOL_DATA, pools: 'bad' };
    expect(() => validate(data)).toThrow('"pools" must be an array');
  });

  test('throws when pool is missing id', () => {
    const data = { ...POOL_DATA, pools: [{ name: 'No Id', lanes: [] }] };
    expect(() => validate(data)).toThrow('pool must have a string "id"');
  });

  test('throws on duplicate pool id', () => {
    const data = {
      ...POOL_DATA,
      pools: [
        { id: 'pool1', name: 'A', lanes: [] },
        { id: 'pool1', name: 'B', lanes: [] },
      ],
    };
    expect(() => validate(data)).toThrow('Duplicate pool id');
  });

  test('throws when pool lanes is not an array', () => {
    const data = {
      ...POOL_DATA,
      pools: [{ id: 'pool1', name: 'P', lanes: 'bad' }],
    };
    expect(() => validate(data)).toThrow('"lanes" must be an array');
  });

  test('throws when lane is missing id', () => {
    const data = {
      ...POOL_DATA,
      pools: [{ id: 'pool1', name: 'P', lanes: [{ name: 'No Id' }] }],
    };
    expect(() => validate(data)).toThrow('lane must have a string "id"');
  });

  test('throws on duplicate lane id', () => {
    const data = {
      ...POOL_DATA,
      pools: [
        { id: 'pool1', name: 'P', lanes: [{ id: 'lane1', name: 'X' }, { id: 'lane1', name: 'Y' }] },
      ],
    };
    expect(() => validate(data)).toThrow('Duplicate lane id');
  });

  test('throws when element laneRef references unknown lane', () => {
    const data = {
      ...POOL_DATA,
      elements: [
        { id: 'start1', type: 'startEvent', laneRef: 'nonexistent' },
        ...POOL_DATA.elements.slice(1),
      ],
    };
    expect(() => validate(data)).toThrow('laneRef');
  });

  test('throws when laneRef is used but no pools are defined', () => {
    const data = {
      ...MINIMAL_DATA,
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start', laneRef: 'lane1' },
        ...MINIMAL_DATA.elements.slice(1),
      ],
    };
    expect(() => validate(data)).toThrow('laneRef');
  });
});

describe('generate() – pools and lanes', () => {
  test('output contains bpmn:collaboration with correct id', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('<bpmn:collaboration id="Collaboration_1"');
  });

  test('output contains participant for each pool', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('<bpmn:participant');
    expect(xml).toContain('id="pool1"');
    expect(xml).toContain('name="Customer"');
    expect(xml).toContain('processRef="Process_pool1"');
  });

  test('output contains laneSet within process', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('<bpmn:laneSet');
    expect(xml).toContain('<bpmn:lane id="lane1"');
    expect(xml).toContain('name="Sales"');
    expect(xml).toContain('<bpmn:lane id="lane2"');
    expect(xml).toContain('name="Operations"');
  });

  test('output contains flowNodeRef entries for lane-assigned elements', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('<bpmn:flowNodeRef>start1</bpmn:flowNodeRef>');
    expect(xml).toContain('<bpmn:flowNodeRef>task1</bpmn:flowNodeRef>');
    expect(xml).toContain('<bpmn:flowNodeRef>task2</bpmn:flowNodeRef>');
    expect(xml).toContain('<bpmn:flowNodeRef>end1</bpmn:flowNodeRef>');
  });

  test('BPMNPlane references collaboration when pools are defined', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('bpmnElement="Collaboration_1"');
  });

  test('output contains pool BPMNShape with isHorizontal', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('id="pool1_di"');
    expect(xml).toContain('isHorizontal="true"');
  });

  test('output contains BPMNShape for each lane', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('id="lane1_di"');
    expect(xml).toContain('id="lane2_di"');
  });

  test('output contains BPMNShape for each element', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('id="start1_di"');
    expect(xml).toContain('id="task1_di"');
    expect(xml).toContain('id="task2_di"');
    expect(xml).toContain('id="end1_di"');
  });

  test('output contains BPMNEdge for each flow', () => {
    const xml = generate(POOL_DATA);
    expect(xml).toContain('id="f1_di"');
    expect(xml).toContain('id="f2_di"');
    expect(xml).toContain('id="f3_di"');
  });

  test('elements in different lanes have different Y coordinates', () => {
    const xml = generate(POOL_DATA);
    const yTask1 = getShapeY(xml, 'task1');
    const yTask2 = getShapeY(xml, 'task2');
    expect(yTask1).not.toBeNull();
    expect(yTask2).not.toBeNull();
    expect(yTask1).not.toBe(yTask2);
  });

  test('elements in the same lane share the same Y coordinate', () => {
    const xml = generate(POOL_DATA);
    // start1 (eventSize=36) and task1 (elementHeight=80) are both in lane1
    // Both are vertically centred in lane1: y = laneY + laneHeight/2 - height/2
    // Their vertical centres (y + height/2) must be identical.
    const yStart = getShapeY(xml, 'start1');
    const yTask1 = getShapeY(xml, 'task1');
    expect(yStart).not.toBeNull();
    expect(yTask1).not.toBeNull();
    const centreStart = yStart + 36 / 2;  // eventSize / 2
    const centreTask1 = yTask1 + 80 / 2;  // elementHeight / 2
    expect(centreStart).toBe(centreTask1);
  });

  test('pool without lanes generates pool shape but no lane shapes', () => {
    const data = {
      name: 'Simple Pool',
      pools: [{ id: 'pool1', name: 'My Pool' }],
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start' },
        { id: 'end1',   type: 'endEvent',   name: 'End'   },
      ],
      flows: [{ id: 'f1', source: 'start1', target: 'end1' }],
    };
    const xml = generate(data);
    expect(xml).toContain('id="pool1_di"');
    // No lane shapes expected
    expect(xml).not.toMatch(/id="lane\w+_di"/);
  });

  test('multiple pools generate multiple participants and processes', () => {
    const data = {
      name: 'Multi Pool',
      pools: [
        { id: 'pool1', name: 'Customer', lanes: [{ id: 'lane1', name: 'Order' }] },
        { id: 'pool2', name: 'Vendor',   lanes: [{ id: 'lane2', name: 'Fulfill' }] },
      ],
      elements: [
        { id: 'start1', type: 'startEvent', name: 'Start',   laneRef: 'lane1' },
        { id: 'end1',   type: 'endEvent',   name: 'End',     laneRef: 'lane1' },
        { id: 'vtask1', type: 'task',       name: 'Fulfill', laneRef: 'lane2' },
      ],
      flows: [{ id: 'f1', source: 'start1', target: 'end1' }],
    };
    const xml = generate(data);
    expect(xml).toContain('id="pool1"');
    expect(xml).toContain('id="pool2"');
    expect(xml).toContain('id="Process_pool1"');
    expect(xml).toContain('id="Process_pool2"');
    // Both pools stacked → pool2 shape y > pool1 shape y
    const yPool1 = (() => {
      const m = xml.match(/id="pool1_di"[\s\S]*?<dc:Bounds[^>]*y="([^"]+)"/);
      return m ? parseFloat(m[1]) : null;
    })();
    const yPool2 = (() => {
      const m = xml.match(/id="pool2_di"[\s\S]*?<dc:Bounds[^>]*y="([^"]+)"/);
      return m ? parseFloat(m[1]) : null;
    })();
    expect(yPool1).not.toBeNull();
    expect(yPool2).not.toBeNull();
    expect(yPool2).toBeGreaterThan(yPool1);
  });

  test('cross-pool flows are excluded from sequence flows', () => {
    const data = {
      name: 'Cross Pool',
      pools: [
        { id: 'pool1', name: 'A', lanes: [{ id: 'lane1', name: 'L1' }] },
        { id: 'pool2', name: 'B', lanes: [{ id: 'lane2', name: 'L2' }] },
      ],
      elements: [
        { id: 'task1', type: 'task', name: 'T1', laneRef: 'lane1' },
        { id: 'task2', type: 'task', name: 'T2', laneRef: 'lane2' },
      ],
      flows: [
        // cross-pool flow — should not appear in sequenceFlows
        { id: 'crossFlow', source: 'task1', target: 'task2' },
      ],
    };
    const xml = generate(data);
    expect(xml).not.toContain('id="crossFlow"');
  });

  test('generate with pools still starts with XML declaration', () => {
    expect(generate(POOL_DATA)).toMatch(/^<\?xml version="1\.0"/);
  });

  test('generate with pools escapes XML special characters in pool and lane names', () => {
    const data = {
      name: 'P',
      pools: [
        {
          id: 'pool1',
          name: 'A & B',
          lanes: [{ id: 'lane1', name: '<Sales>' }],
        },
      ],
      elements: [{ id: 'start1', type: 'startEvent', laneRef: 'lane1' }],
      flows: [],
    };
    const xml = generate(data);
    expect(xml).toContain('name="A &amp; B"');
    expect(xml).toContain('name="&lt;Sales&gt;"');
  });
});

// ---------------------------------------------------------------------------
// Orthogonal flow routing and gateway corner distribution
// ---------------------------------------------------------------------------

/**
 * Helper: extract ordered waypoints from the BPMNEdge for a given flow id.
 * Returns an array of {x, y} objects.
 */
function getEdgeWaypoints(xml, flowId) {
  const escapedId = flowId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const edgeRe = new RegExp(`id="${escapedId}_di"[\\s\\S]*?</bpmndi:BPMNEdge>`);
  const edgeMatch = xml.match(edgeRe);
  if (!edgeMatch) return null;
  const waypointRe = /<di:waypoint x="([^"]+)" y="([^"]+)"/g;
  const waypoints = [];
  let m;
  while ((m = waypointRe.exec(edgeMatch[0])) !== null) {
    waypoints.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
  }
  return waypoints;
}

describe('orthogonal flow routing', () => {
  const BRANCH_DATA = {
    name: 'Branch Process',
    elements: [
      { id: 'start1', type: 'startEvent',      name: 'Start' },
      { id: 'gw1',   type: 'exclusiveGateway', name: 'Split' },
      { id: 'taskA', type: 'task',             name: 'Task A' },
      { id: 'taskB', type: 'task',             name: 'Task B' },
      { id: 'end1',  type: 'endEvent',         name: 'End'   },
    ],
    flows: [
      { id: 'f1', source: 'start1', target: 'gw1'   },
      { id: 'f2', source: 'gw1',   target: 'taskA'  },
      { id: 'f3', source: 'gw1',   target: 'taskB'  },
      { id: 'f4', source: 'taskA', target: 'end1'   },
      { id: 'f5', source: 'taskB', target: 'end1'   },
    ],
  };

  test('flow between elements at same Y has exactly 2 waypoints', () => {
    // MINIMAL_DATA: start1 → task1 → end1 are all on row 0 (same Y centre)
    const xml = generate(MINIMAL_DATA);
    const wp = getEdgeWaypoints(xml, 'flow1');
    expect(wp).not.toBeNull();
    expect(wp).toHaveLength(2);
  });

  test('vertical-exit flow between elements at different Y has exactly 3 waypoints', () => {
    const xml = generate(BRANCH_DATA);
    // f3 goes from gw1 (bottom corner) to taskB on a different row.
    // Vertical exit with different X → 3 waypoints (horizontal segment then vertical entry).
    const wpA = getEdgeWaypoints(xml, 'f2'); // gw1 → taskA (same row, right corner)
    const wpB = getEdgeWaypoints(xml, 'f3'); // gw1 → taskB (different row, bottom corner)
    // f3 must produce 3 waypoints; f2 is same-Y → 2 waypoints
    const counts = [wpA, wpB].map((wp) => wp ? wp.length : 0);
    expect(Math.max(...counts)).toBe(3);
  });

  test('horizontal-exit flow between elements at different Y has exactly 4 waypoints', () => {
    // A flow exiting horizontally but with different Y needs 4 waypoints so that
    // both the exit from the source and the entry into the target are perpendicular.
    const xml = generate(POOL_DATA);
    // f2: task1 (lane1, exits right) → task2 (lane2) — different Y bands
    const wp = getEdgeWaypoints(xml, 'f2');
    expect(wp).not.toBeNull();
    expect(wp).toHaveLength(4);
  });

  test('last flow waypoint lies on the target element boundary (perpendicular entry)', () => {
    // Verify that the last waypoint of each flow is exactly on the boundary of
    // the target shape (not inside or outside it).
    function getShapeBounds(xml, elementId) {
      const escapedId = elementId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`id="${escapedId}_di"[\\s\\S]*?x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"`);
      const m = xml.match(re);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), width: parseFloat(m[3]), height: parseFloat(m[4]) } : null;
    }
    const xml = generate(POOL_DATA);
    const flowIds = ['f2', 'f3'];
    const flowTargets = { f2: 'task2', f3: 'end1' };
    for (const fId of flowIds) {
      const wp = getEdgeWaypoints(xml, fId);
      if (!wp) continue;
      const last = wp[wp.length - 1];
      const bounds = getShapeBounds(xml, flowTargets[fId]);
      if (!bounds) continue;
      // Last waypoint must be on one of the four edges of the target
      const onLeft   = last.x === bounds.x && last.y >= bounds.y && last.y <= bounds.y + bounds.height;
      const onRight  = last.x === bounds.x + bounds.width && last.y >= bounds.y && last.y <= bounds.y + bounds.height;
      const onTop    = last.y === bounds.y && last.x >= bounds.x && last.x <= bounds.x + bounds.width;
      const onBottom = last.y === bounds.y + bounds.height && last.x >= bounds.x && last.x <= bounds.x + bounds.width;
      expect(onLeft || onRight || onTop || onBottom).toBe(true);
    }
  });

  test('orthogonal intermediate waypoint aligns with source exit Y or target entry X', () => {
    const xml = generate(BRANCH_DATA);
    const wp2 = getEdgeWaypoints(xml, 'f2');
    const wp3 = getEdgeWaypoints(xml, 'f3');
    // For each 3-waypoint flow the middle point must share X with the last waypoint
    // (horizontal-first) OR share X with the first waypoint (vertical-first).
    for (const wp of [wp2, wp3].filter((w) => w && w.length === 3)) {
      const [p1, p2, p3] = wp;
      const horizontalFirst = p2.x === p3.x && p2.y === p1.y;
      const verticalFirst   = p2.y === p3.y && p2.x === p1.x;
      expect(horizontalFirst || verticalFirst).toBe(true);
    }
  });

  test('gateway with 2 outgoing flows uses 2 distinct exit corners', () => {
    const xml = generate(BRANCH_DATA);
    const wp2 = getEdgeWaypoints(xml, 'f2');
    const wp3 = getEdgeWaypoints(xml, 'f3');
    expect(wp2).not.toBeNull();
    expect(wp3).not.toBeNull();
    // The first waypoint (exit corner) of f2 and f3 must differ
    expect(wp2[0].x !== wp3[0].x || wp2[0].y !== wp3[0].y).toBe(true);
  });

  test('gateway with 3 outgoing flows uses 3 distinct exit corners', () => {
    const data = {
      name: 'Three Branch',
      elements: [
        { id: 'start1', type: 'startEvent',      name: 'Start' },
        { id: 'gw1',    type: 'parallelGateway', name: 'Split' },
        { id: 'taskA',  type: 'task',            name: 'A' },
        { id: 'taskB',  type: 'task',            name: 'B' },
        { id: 'taskC',  type: 'task',            name: 'C' },
        { id: 'end1',   type: 'endEvent',        name: 'End' },
      ],
      flows: [
        { id: 'f1', source: 'start1', target: 'gw1'   },
        { id: 'f2', source: 'gw1',   target: 'taskA'  },
        { id: 'f3', source: 'gw1',   target: 'taskB'  },
        { id: 'f4', source: 'gw1',   target: 'taskC'  },
        { id: 'f5', source: 'taskA', target: 'end1'   },
        { id: 'f6', source: 'taskB', target: 'end1'   },
        { id: 'f7', source: 'taskC', target: 'end1'   },
      ],
    };
    const xml = generate(data);
    const exit2 = getEdgeWaypoints(xml, 'f2')[0];
    const exit3 = getEdgeWaypoints(xml, 'f3')[0];
    const exit4 = getEdgeWaypoints(xml, 'f4')[0];
    // All three exit points must be pairwise distinct
    const points = [exit2, exit3, exit4];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        expect(points[i].x !== points[j].x || points[i].y !== points[j].y).toBe(true);
      }
    }
  });

  test('pool flows with different lane Y coordinates are routed orthogonally', () => {
    const xml = generate(POOL_DATA);
    // f2: task1 (lane1) → task2 (lane2) — different Y bands.
    // Horizontal exit with different Y uses 4 waypoints (midX routing) so that
    // the flow meets the target perpendicularly (horizontal last segment).
    const wp = getEdgeWaypoints(xml, 'f2');
    expect(wp).not.toBeNull();
    expect(wp).toHaveLength(4);
  });

  test('pool flow intermediate waypoint creates a right-angle bend', () => {
    const xml = generate(POOL_DATA);
    const wp = getEdgeWaypoints(xml, 'f2');
    if (!wp || wp.length < 3) return; // only check flows with bends
    const [p1, p2, p3] = wp;
    // For 4-waypoint midX routing: first 3 points satisfy horizontalFirst
    // For 3-waypoint vertical-first routing: verticalFirst holds
    const horizontalFirst = p2.x === p3.x && p2.y === p1.y;
    const verticalFirst   = p2.y === p3.y && p2.x === p1.x;
    expect(horizontalFirst || verticalFirst).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flow-Merge Gateway Enhancement
// ---------------------------------------------------------------------------

describe('insertMergeGateways()', () => {
  // Data where gw1 is a pure split (1 in, 2 out) – no merge gateway needed.
  // Data where gw2 is a pure join (2 in, 1 out) – no merge gateway needed.
  const SPLIT_JOIN_DATA = {
    elements: [
      { id: 'start1', type: 'startEvent' },
      { id: 'gw1',   type: 'parallelGateway' },
      { id: 'taskA', type: 'task' },
      { id: 'taskB', type: 'task' },
      { id: 'gw2',   type: 'parallelGateway' },
      { id: 'end1',  type: 'endEvent' },
    ],
    flows: [
      { id: 'f1', source: 'start1', target: 'gw1'   },
      { id: 'f2', source: 'gw1',   target: 'taskA'  },
      { id: 'f3', source: 'gw1',   target: 'taskB'  },
      { id: 'f4', source: 'taskA', target: 'gw2'    },
      { id: 'f5', source: 'taskB', target: 'gw2'    },
      { id: 'f6', source: 'gw2',   target: 'end1'   },
    ],
  };

  // Data where gw_combined has 2 incoming AND 2 outgoing – merge gateway needed.
  const COMBINED_GW_DATA = {
    elements: [
      { id: 'start1',      type: 'startEvent'      },
      { id: 'gw_split',   type: 'exclusiveGateway' },
      { id: 'taskA',      type: 'task'             },
      { id: 'taskB',      type: 'task'             },
      { id: 'gw_combined', type: 'exclusiveGateway' },
      { id: 'end1',       type: 'endEvent'         },
      { id: 'end2',       type: 'endEvent'         },
    ],
    flows: [
      { id: 'f1', source: 'start1',      target: 'gw_split'    },
      { id: 'f2', source: 'gw_split',    target: 'taskA'        },
      { id: 'f3', source: 'gw_split',    target: 'taskB'        },
      { id: 'f4', source: 'taskA',       target: 'gw_combined'  },
      { id: 'f5', source: 'taskB',       target: 'gw_combined'  },
      { id: 'f6', source: 'gw_combined', target: 'end1'         },
      { id: 'f7', source: 'gw_combined', target: 'end2'         },
    ],
  };

  test('does not insert a merge gateway when no gateway has both multi-in and multi-out', () => {
    const { elements, flows } = insertMergeGateways(SPLIT_JOIN_DATA.elements, SPLIT_JOIN_DATA.flows);
    expect(elements).toHaveLength(SPLIT_JOIN_DATA.elements.length);
    expect(flows).toHaveLength(SPLIT_JOIN_DATA.flows.length);
  });

  test('inserts exactly one merge gateway for a combined join-split gateway', () => {
    const { elements } = insertMergeGateways(COMBINED_GW_DATA.elements, COMBINED_GW_DATA.flows);
    expect(elements).toHaveLength(COMBINED_GW_DATA.elements.length + 1);
    const mergeGw = elements.find((e) => e.id === 'gw_combined_merge');
    expect(mergeGw).toBeDefined();
  });

  test('merge gateway has the same type as the original gateway', () => {
    const { elements } = insertMergeGateways(COMBINED_GW_DATA.elements, COMBINED_GW_DATA.flows);
    const mergeGw = elements.find((e) => e.id === 'gw_combined_merge');
    expect(mergeGw.type).toBe('exclusiveGateway');
  });

  test('merge gateway is inserted immediately before the original gateway', () => {
    const { elements } = insertMergeGateways(COMBINED_GW_DATA.elements, COMBINED_GW_DATA.flows);
    const mergeIdx = elements.findIndex((e) => e.id === 'gw_combined_merge');
    const origIdx  = elements.findIndex((e) => e.id === 'gw_combined');
    expect(mergeIdx).toBe(origIdx - 1);
  });

  test('incoming flows are redirected to the merge gateway', () => {
    const { flows } = insertMergeGateways(COMBINED_GW_DATA.elements, COMBINED_GW_DATA.flows);
    const f4 = flows.find((f) => f.id === 'f4');
    const f5 = flows.find((f) => f.id === 'f5');
    expect(f4.target).toBe('gw_combined_merge');
    expect(f5.target).toBe('gw_combined_merge');
  });

  test('a new connecting flow is added from merge gateway to original gateway', () => {
    const { flows } = insertMergeGateways(COMBINED_GW_DATA.elements, COMBINED_GW_DATA.flows);
    expect(flows).toHaveLength(COMBINED_GW_DATA.flows.length + 1);
    const connectFlow = flows.find((f) => f.id === 'gw_combined_merge_flow');
    expect(connectFlow).toBeDefined();
    expect(connectFlow.source).toBe('gw_combined_merge');
    expect(connectFlow.target).toBe('gw_combined');
  });

  test('outgoing flows of the original gateway remain unchanged', () => {
    const { flows } = insertMergeGateways(COMBINED_GW_DATA.elements, COMBINED_GW_DATA.flows);
    const f6 = flows.find((f) => f.id === 'f6');
    const f7 = flows.find((f) => f.id === 'f7');
    expect(f6.source).toBe('gw_combined');
    expect(f7.source).toBe('gw_combined');
  });

  test('merge gateway inherits laneRef from original gateway', () => {
    const dataWithLane = {
      elements: [
        { id: 'gw1', type: 'parallelGateway', laneRef: 'lane1' },
        { id: 'taskA', type: 'task' },
        { id: 'taskB', type: 'task' },
        { id: 'end1', type: 'endEvent' },
        { id: 'end2', type: 'endEvent' },
      ],
      flows: [
        { id: 'f1', source: 'taskA', target: 'gw1'  },
        { id: 'f2', source: 'taskB', target: 'gw1'  },
        { id: 'f3', source: 'gw1',   target: 'end1' },
        { id: 'f4', source: 'gw1',   target: 'end2' },
      ],
    };
    const { elements } = insertMergeGateways(dataWithLane.elements, dataWithLane.flows);
    const mergeGw = elements.find((e) => e.id === 'gw1_merge');
    expect(mergeGw).toBeDefined();
    expect(mergeGw.laneRef).toBe('lane1');
  });
});

describe('generate() – merge gateway insertion', () => {
  // A gateway (gw_combined) that both joins two flows and splits into two flows.
  const COMBINED_GW_PROCESS = {
    name: 'Combined Gateway Process',
    elements: [
      { id: 'start1',      type: 'startEvent'      },
      { id: 'gw_split',    type: 'exclusiveGateway' },
      { id: 'taskA',       type: 'task'             },
      { id: 'taskB',       type: 'task'             },
      { id: 'gw_combined', type: 'exclusiveGateway' },
      { id: 'end1',        type: 'endEvent'         },
      { id: 'end2',        type: 'endEvent'         },
    ],
    flows: [
      { id: 'f1', source: 'start1',      target: 'gw_split'    },
      { id: 'f2', source: 'gw_split',    target: 'taskA'        },
      { id: 'f3', source: 'gw_split',    target: 'taskB'        },
      { id: 'f4', source: 'taskA',       target: 'gw_combined'  },
      { id: 'f5', source: 'taskB',       target: 'gw_combined'  },
      { id: 'f6', source: 'gw_combined', target: 'end1'         },
      { id: 'f7', source: 'gw_combined', target: 'end2'         },
    ],
  };

  test('generated XML contains an auto-inserted merge gateway element', () => {
    const xml = generate(COMBINED_GW_PROCESS);
    expect(xml).toContain('id="gw_combined_merge"');
  });

  test('auto-inserted merge gateway has the same BPMN type as original', () => {
    const xml = generate(COMBINED_GW_PROCESS);
    // The merge gateway element must appear as an exclusiveGateway with the generated id
    expect(xml).toMatch(/<bpmn:exclusiveGateway[^>]*id="gw_combined_merge"/);
  });

  test('auto-inserted merge gateway has a BPMNShape in the diagram', () => {
    const xml = generate(COMBINED_GW_PROCESS);
    expect(xml).toContain('bpmnElement="gw_combined_merge"');
  });

  test('connecting flow from merge gateway to original gateway appears in XML', () => {
    const xml = generate(COMBINED_GW_PROCESS);
    expect(xml).toContain('id="gw_combined_merge_flow"');
    expect(xml).toContain('sourceRef="gw_combined_merge"');
    expect(xml).toContain('targetRef="gw_combined"');
  });

  test('parallel gateway variant also gets a merge gateway', () => {
    const data = {
      name: 'Parallel Combined',
      elements: [
        { id: 'start1', type: 'startEvent'      },
        { id: 'gwA',    type: 'parallelGateway' },
        { id: 'taskA',  type: 'task'            },
        { id: 'taskB',  type: 'task'            },
        { id: 'gwB',    type: 'parallelGateway' },
        { id: 'end1',   type: 'endEvent'        },
        { id: 'end2',   type: 'endEvent'        },
      ],
      flows: [
        { id: 'f1', source: 'start1', target: 'gwA'   },
        { id: 'f2', source: 'gwA',    target: 'taskA'  },
        { id: 'f3', source: 'gwA',    target: 'taskB'  },
        { id: 'f4', source: 'taskA',  target: 'gwB'    },
        { id: 'f5', source: 'taskB',  target: 'gwB'    },
        { id: 'f6', source: 'gwB',    target: 'end1'   },
        { id: 'f7', source: 'gwB',    target: 'end2'   },
      ],
    };
    const xml = generate(data);
    expect(xml).toContain('id="gwB_merge"');
    expect(xml).toMatch(/<bpmn:parallelGateway[^>]*id="gwB_merge"/);
  });
});

// ---------------------------------------------------------------------------
// Auto-gateway insertion for non-gateway elements with multiple incoming flows
// ---------------------------------------------------------------------------

describe('insertMergeGateways() – non-gateway elements with multiple incoming flows', () => {
  // Two tasks flow into a single task (task_target). The split is performed by
  // an exclusiveGateway (gw_split), so the auto-inserted gateway should also
  // be an exclusiveGateway.
  const TASK_MERGE_EXCLUSIVE = {
    elements: [
      { id: 'start1',      type: 'startEvent'      },
      { id: 'gw_split',   type: 'exclusiveGateway' },
      { id: 'taskA',      type: 'task'             },
      { id: 'taskB',      type: 'task'             },
      { id: 'task_target', type: 'task'            },
      { id: 'end1',       type: 'endEvent'         },
    ],
    flows: [
      { id: 'f1', source: 'start1',      target: 'gw_split'    },
      { id: 'f2', source: 'gw_split',    target: 'taskA'       },
      { id: 'f3', source: 'gw_split',    target: 'taskB'       },
      { id: 'f4', source: 'taskA',       target: 'task_target' },
      { id: 'f5', source: 'taskB',       target: 'task_target' },
      { id: 'f6', source: 'task_target', target: 'end1'        },
    ],
  };

  // Two tasks flow into a single task via a parallelGateway split.
  const TASK_MERGE_PARALLEL = {
    elements: [
      { id: 'start1',      type: 'startEvent'     },
      { id: 'gw_par',     type: 'parallelGateway' },
      { id: 'taskA',      type: 'task'            },
      { id: 'taskB',      type: 'task'            },
      { id: 'task_target', type: 'task'           },
      { id: 'end1',       type: 'endEvent'        },
    ],
    flows: [
      { id: 'f1', source: 'start1',      target: 'gw_par'     },
      { id: 'f2', source: 'gw_par',      target: 'taskA'      },
      { id: 'f3', source: 'gw_par',      target: 'taskB'      },
      { id: 'f4', source: 'taskA',       target: 'task_target'},
      { id: 'f5', source: 'taskB',       target: 'task_target'},
      { id: 'f6', source: 'task_target', target: 'end1'       },
    ],
  };

  // Two tasks flow into a single task with no preceding gateway (default).
  const TASK_MERGE_NO_GATEWAY = {
    elements: [
      { id: 'start1',      type: 'startEvent' },
      { id: 'taskA',       type: 'task'       },
      { id: 'taskB',       type: 'task'       },
      { id: 'task_target', type: 'task'       },
      { id: 'end1',        type: 'endEvent'   },
    ],
    flows: [
      { id: 'f1', source: 'start1',      target: 'taskA'       },
      { id: 'f2', source: 'start1',      target: 'taskB'       },
      { id: 'f3', source: 'taskA',       target: 'task_target' },
      { id: 'f4', source: 'taskB',       target: 'task_target' },
      { id: 'f5', source: 'task_target', target: 'end1'        },
    ],
  };

  test('inserts a merge gateway before a non-gateway element with multiple incoming flows', () => {
    const { elements } = insertMergeGateways(TASK_MERGE_EXCLUSIVE.elements, TASK_MERGE_EXCLUSIVE.flows);
    const mergeGw = elements.find((e) => e.id === 'task_target_merge');
    expect(mergeGw).toBeDefined();
  });

  test('merge gateway for non-gateway element uses type of preceding exclusiveGateway', () => {
    const { elements } = insertMergeGateways(TASK_MERGE_EXCLUSIVE.elements, TASK_MERGE_EXCLUSIVE.flows);
    const mergeGw = elements.find((e) => e.id === 'task_target_merge');
    expect(mergeGw.type).toBe('exclusiveGateway');
  });

  test('merge gateway for non-gateway element uses type of preceding parallelGateway', () => {
    const { elements } = insertMergeGateways(TASK_MERGE_PARALLEL.elements, TASK_MERGE_PARALLEL.flows);
    const mergeGw = elements.find((e) => e.id === 'task_target_merge');
    expect(mergeGw.type).toBe('parallelGateway');
  });

  test('merge gateway defaults to exclusiveGateway when no preceding gateway exists', () => {
    const { elements } = insertMergeGateways(TASK_MERGE_NO_GATEWAY.elements, TASK_MERGE_NO_GATEWAY.flows);
    const mergeGw = elements.find((e) => e.id === 'task_target_merge');
    expect(mergeGw).toBeDefined();
    expect(mergeGw.type).toBe('exclusiveGateway');
  });

  test('merge gateway is inserted immediately before the non-gateway element', () => {
    const { elements } = insertMergeGateways(TASK_MERGE_EXCLUSIVE.elements, TASK_MERGE_EXCLUSIVE.flows);
    const mergeIdx = elements.findIndex((e) => e.id === 'task_target_merge');
    const origIdx  = elements.findIndex((e) => e.id === 'task_target');
    expect(mergeIdx).toBe(origIdx - 1);
  });

  test('incoming flows are redirected to the merge gateway', () => {
    const { flows } = insertMergeGateways(TASK_MERGE_EXCLUSIVE.elements, TASK_MERGE_EXCLUSIVE.flows);
    const f4 = flows.find((f) => f.id === 'f4');
    const f5 = flows.find((f) => f.id === 'f5');
    expect(f4.target).toBe('task_target_merge');
    expect(f5.target).toBe('task_target_merge');
  });

  test('a new connecting flow is added from the merge gateway to the original element', () => {
    const { flows } = insertMergeGateways(TASK_MERGE_EXCLUSIVE.elements, TASK_MERGE_EXCLUSIVE.flows);
    const connectFlow = flows.find((f) => f.id === 'task_target_merge_flow');
    expect(connectFlow).toBeDefined();
    expect(connectFlow.source).toBe('task_target_merge');
    expect(connectFlow.target).toBe('task_target');
  });

  test('non-gateway element with only one incoming flow is not affected', () => {
    const { elements, flows } = insertMergeGateways(
      TASK_MERGE_EXCLUSIVE.elements,
      TASK_MERGE_EXCLUSIVE.flows
    );
    // taskA and taskB each have only one incoming flow – no merge gw for them
    expect(elements.find((e) => e.id === 'taskA_merge')).toBeUndefined();
    expect(elements.find((e) => e.id === 'taskB_merge')).toBeUndefined();
  });

  test('merge gateway for non-gateway element inherits laneRef', () => {
    const dataWithLane = {
      elements: [
        { id: 'taskA',       type: 'task', laneRef: 'lane1' },
        { id: 'taskB',       type: 'task', laneRef: 'lane1' },
        { id: 'task_target', type: 'task', laneRef: 'lane1' },
        { id: 'end1',        type: 'endEvent'               },
      ],
      flows: [
        { id: 'f1', source: 'taskA',       target: 'task_target' },
        { id: 'f2', source: 'taskB',       target: 'task_target' },
        { id: 'f3', source: 'task_target', target: 'end1'        },
      ],
    };
    const { elements } = insertMergeGateways(dataWithLane.elements, dataWithLane.flows);
    const mergeGw = elements.find((e) => e.id === 'task_target_merge');
    expect(mergeGw).toBeDefined();
    expect(mergeGw.laneRef).toBe('lane1');
  });
});

// ---------------------------------------------------------------------------
// Custom flow waypoints
// ---------------------------------------------------------------------------

describe('generate() – custom flow waypoints', () => {
  test('uses custom waypoints from flow.waypoints instead of computing them', () => {
    const customWaypoints = [
      { x: 100, y: 200 },
      { x: 300, y: 200 },
      { x: 300, y: 400 },
    ];
    const data = {
      ...MINIMAL_DATA,
      flows: [
        { id: 'flow1', source: 'start1', target: 'task1', waypoints: customWaypoints },
        { id: 'flow2', source: 'task1',  target: 'end1'  },
      ],
    };
    const xml = generate(data);
    const wp = getEdgeWaypoints(xml, 'flow1');
    expect(wp).not.toBeNull();
    expect(wp).toHaveLength(3);
    expect(wp[0]).toEqual({ x: 100, y: 200 });
    expect(wp[1]).toEqual({ x: 300, y: 200 });
    expect(wp[2]).toEqual({ x: 300, y: 400 });
  });

  test('falls back to computed waypoints when flow.waypoints is absent', () => {
    const xml = generate(MINIMAL_DATA);
    const wp = getEdgeWaypoints(xml, 'flow1');
    expect(wp).not.toBeNull();
    expect(wp.length).toBeGreaterThanOrEqual(2);
  });

  test('ignores flow.waypoints when it has fewer than 2 points', () => {
    const data = {
      ...MINIMAL_DATA,
      flows: [
        { id: 'flow1', source: 'start1', target: 'task1', waypoints: [{ x: 50, y: 50 }] },
        { id: 'flow2', source: 'task1',  target: 'end1'  },
      ],
    };
    const xml = generate(data);
    const wp = getEdgeWaypoints(xml, 'flow1');
    // Falls back to computed waypoints (at least 2 points)
    expect(wp).not.toBeNull();
    expect(wp.length).toBeGreaterThanOrEqual(2);
    // Computed first waypoint will not be x=50
    expect(wp[0].x).not.toBe(50);
  });

  test('custom waypoints in pool-based process are used for pool flows', () => {
    const customWaypoints = [
      { x: 200, y: 120 },
      { x: 400, y: 120 },
      { x: 400, y: 300 },
      { x: 500, y: 300 },
    ];
    const data = {
      ...POOL_DATA,
      flows: [
        { id: 'f1', source: 'start1', target: 'task1' },
        { id: 'f2', source: 'task1',  target: 'task2', waypoints: customWaypoints },
        { id: 'f3', source: 'task2',  target: 'end1'  },
      ],
    };
    const xml = generate(data);
    const wp = getEdgeWaypoints(xml, 'f2');
    expect(wp).not.toBeNull();
    expect(wp).toHaveLength(4);
    expect(wp[0]).toEqual({ x: 200, y: 120 });
    expect(wp[3]).toEqual({ x: 500, y: 300 });
  });
});

// ---------------------------------------------------------------------------
// Custom lane dimensions
// ---------------------------------------------------------------------------

describe('generate() – custom lane width and height', () => {
  /**
   * Extract the dc:Bounds for a given bpmnElement id from the diagram section.
   */
  function getShapeBoundsById(xml, elementId) {
    const escapedId = elementId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `bpmnElement="${escapedId}"[\\s\\S]*?x="([^"]+)"[\\s\\S]*?y="([^"]+)"[\\s\\S]*?width="([^"]+)"[\\s\\S]*?height="([^"]+)"`
    );
    const m = xml.match(re);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]), width: parseFloat(m[3]), height: parseFloat(m[4]) };
  }

  test('custom lane.width overrides the computed pool content width', () => {
    const customLaneWidth = 900;
    const data = {
      ...POOL_DATA,
      pools: [
        {
          id: 'pool1',
          name: 'Customer',
          lanes: [
            { id: 'lane1', name: 'Sales',      width: customLaneWidth },
            { id: 'lane2', name: 'Operations', width: customLaneWidth },
          ],
        },
      ],
    };
    const xml = generate(data);
    const lane1Bounds = getShapeBoundsById(xml, 'lane1');
    expect(lane1Bounds).not.toBeNull();
    expect(lane1Bounds.width).toBe(customLaneWidth);
  });

  test('custom lane.height overrides the default lane height', () => {
    const customHeight = 260;
    const data = {
      ...POOL_DATA,
      pools: [
        {
          id: 'pool1',
          name: 'Customer',
          lanes: [
            { id: 'lane1', name: 'Sales',      height: customHeight },
            { id: 'lane2', name: 'Operations', height: customHeight },
          ],
        },
      ],
    };
    const xml = generate(data);
    const lane1Bounds = getShapeBoundsById(xml, 'lane1');
    expect(lane1Bounds).not.toBeNull();
    expect(lane1Bounds.height).toBe(customHeight);
  });

  test('lanes with different custom heights stack correctly (cumulative Y)', () => {
    const data = {
      ...POOL_DATA,
      pools: [
        {
          id: 'pool1',
          name: 'Customer',
          lanes: [
            { id: 'lane1', name: 'Sales',      height: 120 },
            { id: 'lane2', name: 'Operations', height: 240 },
          ],
        },
      ],
    };
    const xml = generate(data);
    const b1 = getShapeBoundsById(xml, 'lane1');
    const b2 = getShapeBoundsById(xml, 'lane2');
    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    // lane2 starts immediately after lane1 ends
    expect(b2.y).toBe(b1.y + b1.height);
    expect(b1.height).toBe(120);
    expect(b2.height).toBe(240);
  });

  test('default lane dimensions are used when no custom dimensions are provided', () => {
    const xml = generate(POOL_DATA);
    const lane1Bounds = getShapeBoundsById(xml, 'lane1');
    const lane2Bounds = getShapeBoundsById(xml, 'lane2');
    expect(lane1Bounds).not.toBeNull();
    expect(lane2Bounds).not.toBeNull();
    // Default height is 180; both lanes should be the same height and stack consecutively
    expect(lane1Bounds.height).toBe(180);
    expect(lane2Bounds.height).toBe(180);
    expect(lane2Bounds.y).toBe(lane1Bounds.y + lane1Bounds.height);
  });
});

describe('generate() – auto-gateway for non-gateway elements with multiple incoming flows', () => {
  const NON_GW_MERGE_PROCESS = {
    name: 'Non-Gateway Merge Process',
    elements: [
      { id: 'start1',      type: 'startEvent'      },
      { id: 'gw_split',   type: 'exclusiveGateway' },
      { id: 'taskA',      type: 'task'             },
      { id: 'taskB',      type: 'task'             },
      { id: 'task_target', type: 'task'            },
      { id: 'end1',       type: 'endEvent'         },
    ],
    flows: [
      { id: 'f1', source: 'start1',      target: 'gw_split'    },
      { id: 'f2', source: 'gw_split',    target: 'taskA'       },
      { id: 'f3', source: 'gw_split',    target: 'taskB'       },
      { id: 'f4', source: 'taskA',       target: 'task_target' },
      { id: 'f5', source: 'taskB',       target: 'task_target' },
      { id: 'f6', source: 'task_target', target: 'end1'        },
    ],
  };

  test('generated XML contains an auto-inserted merge gateway for a task element', () => {
    const xml = generate(NON_GW_MERGE_PROCESS);
    expect(xml).toContain('id="task_target_merge"');
  });

  test('auto-inserted merge gateway has the same type as the preceding gateway', () => {
    const xml = generate(NON_GW_MERGE_PROCESS);
    expect(xml).toMatch(/<bpmn:exclusiveGateway[^>]*id="task_target_merge"/);
  });

  test('auto-inserted merge gateway has a BPMNShape in the diagram', () => {
    const xml = generate(NON_GW_MERGE_PROCESS);
    expect(xml).toContain('bpmnElement="task_target_merge"');
  });

  test('connecting flow from merge gateway to task appears in XML', () => {
    const xml = generate(NON_GW_MERGE_PROCESS);
    expect(xml).toContain('id="task_target_merge_flow"');
    expect(xml).toContain('sourceRef="task_target_merge"');
    expect(xml).toContain('targetRef="task_target"');
  });

  test('parallel gateway variant produces a parallelGateway merge for a task', () => {
    const data = {
      name: 'Parallel Task Merge',
      elements: [
        { id: 'start1',      type: 'startEvent'     },
        { id: 'gw_par',     type: 'parallelGateway' },
        { id: 'taskA',      type: 'task'            },
        { id: 'taskB',      type: 'task'            },
        { id: 'task_target', type: 'task'           },
        { id: 'end1',       type: 'endEvent'        },
      ],
      flows: [
        { id: 'f1', source: 'start1',      target: 'gw_par'      },
        { id: 'f2', source: 'gw_par',      target: 'taskA'       },
        { id: 'f3', source: 'gw_par',      target: 'taskB'       },
        { id: 'f4', source: 'taskA',       target: 'task_target' },
        { id: 'f5', source: 'taskB',       target: 'task_target' },
        { id: 'f6', source: 'task_target', target: 'end1'        },
      ],
    };
    const xml = generate(data);
    expect(xml).toContain('id="task_target_merge"');
    expect(xml).toMatch(/<bpmn:parallelGateway[^>]*id="task_target_merge"/);
  });
});
