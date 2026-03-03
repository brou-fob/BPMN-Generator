'use strict';

const { generate, validate, changeElementType, ELEMENT_TYPES } = require('../src/bpmnGenerator');

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
