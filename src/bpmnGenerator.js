'use strict';

/**
 * Supported element types and their BPMN 2.0 XML tag names.
 */
const ELEMENT_TYPES = {
  startEvent: 'bpmn:startEvent',
  endEvent: 'bpmn:endEvent',
  task: 'bpmn:task',
  userTask: 'bpmn:userTask',
  serviceTask: 'bpmn:serviceTask',
  exclusiveGateway: 'bpmn:exclusiveGateway',
  parallelGateway: 'bpmn:parallelGateway',
  inclusiveGateway: 'bpmn:inclusiveGateway',
};

/**
 * Default layout constants for auto-positioning elements.
 */
const LAYOUT = {
  startX: 150,
  startY: 250,
  stepX: 150,
  elementWidth: 100,
  elementHeight: 80,
  gatewaySize: 50,
  eventSize: 36,
};

/**
 * Validates the input data structure.
 * @param {object} data - The structured process data.
 * @throws {Error} if the data is invalid.
 */
function validate(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Input data must be a JSON object.');
  }
  if (!data.name || typeof data.name !== 'string') {
    throw new Error('Field "name" is required and must be a string.');
  }
  if (!Array.isArray(data.elements) || data.elements.length === 0) {
    throw new Error('Field "elements" is required and must be a non-empty array.');
  }
  if (!Array.isArray(data.flows)) {
    throw new Error('Field "flows" is required and must be an array.');
  }

  const ids = new Set();
  for (const el of data.elements) {
    if (!el.id || typeof el.id !== 'string') {
      throw new Error('Each element must have a string "id".');
    }
    if (!el.type || !ELEMENT_TYPES[el.type]) {
      throw new Error(
        `Element "${el.id}" has unknown type "${el.type}". Supported types: ${Object.keys(ELEMENT_TYPES).join(', ')}.`
      );
    }
    if (ids.has(el.id)) {
      throw new Error(`Duplicate element id "${el.id}".`);
    }
    ids.add(el.id);
  }

  const flowIds = new Set();
  for (const flow of data.flows) {
    if (!flow.id || typeof flow.id !== 'string') {
      throw new Error('Each flow must have a string "id".');
    }
    if (!flow.source || !ids.has(flow.source)) {
      throw new Error(`Flow "${flow.id}" references unknown source "${flow.source}".`);
    }
    if (!flow.target || !ids.has(flow.target)) {
      throw new Error(`Flow "${flow.id}" references unknown target "${flow.target}".`);
    }
    if (flowIds.has(flow.id)) {
      throw new Error(`Duplicate flow id "${flow.id}".`);
    }
    flowIds.add(flow.id);
  }
}

/**
 * Escapes special XML characters in attribute values.
 * @param {string} str
 * @returns {string}
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Computes auto-layout positions for each element based on index order.
 * @param {Array} elements
 * @returns {Map<string, {x: number, y: number, width: number, height: number}>}
 */
function computeLayout(elements) {
  const positions = new Map();
  elements.forEach((el, index) => {
    const isGateway = el.type.toLowerCase().includes('gateway');
    const isEvent = el.type === 'startEvent' || el.type === 'endEvent';
    const width = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementWidth;
    const height = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementHeight;
    const x = LAYOUT.startX + index * LAYOUT.stepX;
    const y = LAYOUT.startY - height / 2;
    positions.set(el.id, { x, y, width, height });
  });
  return positions;
}

/**
 * Generates a BPMN 2.0 XML string from structured process data.
 *
 * Expected input format:
 * {
 *   "name": "Process Name",
 *   "elements": [
 *     { "id": "start1", "type": "startEvent", "name": "Start" },
 *     { "id": "task1",  "type": "task",       "name": "Do Something" },
 *     { "id": "end1",   "type": "endEvent",   "name": "End" }
 *   ],
 *   "flows": [
 *     { "id": "flow1", "source": "start1", "target": "task1" },
 *     { "id": "flow2", "source": "task1",  "target": "end1" }
 *   ]
 * }
 *
 * @param {object} data - The structured process data.
 * @returns {string} BPMN 2.0 XML string.
 */
function generate(data) {
  validate(data);

  const processId = 'Process_1';
  const positions = computeLayout(data.elements);

  // Build process elements XML
  const elementLines = data.elements.map((el) => {
    const tag = ELEMENT_TYPES[el.type];
    const name = el.name ? ` name="${escapeXml(el.name)}"` : '';
    return `    <${tag} id="${escapeXml(el.id)}"${name} />`;
  });

  // Build sequence flows XML
  const flowLines = data.flows.map((flow) => {
    const name = flow.name ? ` name="${escapeXml(flow.name)}"` : '';
    return `    <bpmn:sequenceFlow id="${escapeXml(flow.id)}" sourceRef="${escapeXml(flow.source)}" targetRef="${escapeXml(flow.target)}"${name} />`;
  });

  // Build diagram shapes XML
  const shapeLines = data.elements.map((el) => {
    const pos = positions.get(el.id);
    const isGateway = el.type.toLowerCase().includes('gateway');
    const isEvent = el.type === 'startEvent' || el.type === 'endEvent';
    const label = isGateway || isEvent ? '' : `
        <bpmndi:BPMNLabel />`;
    return `      <bpmndi:BPMNShape id="${escapeXml(el.id)}_di" bpmnElement="${escapeXml(el.id)}">
        <dc:Bounds x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" />${label}
      </bpmndi:BPMNShape>`;
  });

  // Build diagram edges XML
  const edgeLines = data.flows.map((flow) => {
    const srcPos = positions.get(flow.source);
    const tgtPos = positions.get(flow.target);
    const srcMidX = srcPos.x + srcPos.width;
    const srcMidY = srcPos.y + srcPos.height / 2;
    const tgtMidX = tgtPos.x;
    const tgtMidY = tgtPos.y + tgtPos.height / 2;
    return `      <bpmndi:BPMNEdge id="${escapeXml(flow.id)}_di" bpmnElement="${escapeXml(flow.id)}">
        <di:waypoint x="${srcMidX}" y="${srcMidY}" />
        <di:waypoint x="${tgtMidX}" y="${tgtMidY}" />
      </bpmndi:BPMNEdge>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="${escapeXml(data.name)}" isExecutable="false">
${elementLines.join('\n')}
${flowLines.join('\n')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">
${shapeLines.join('\n')}
${edgeLines.join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

module.exports = { generate, validate, ELEMENT_TYPES };
