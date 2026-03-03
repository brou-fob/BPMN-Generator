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
  laneSpacing: 120,
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
 * Propagates a lane (row) assignment forward through single-output nodes,
 * stopping at join points (nodes with multiple incoming edges) to preserve
 * convergence positioning.
 * @param {string} id
 * @param {number} targetRow
 * @param {Map} row
 * @param {Map} outEdges
 * @param {Map} inEdges
 * @param {Set} visited
 */
function propagateLane(id, targetRow, row, outEdges, inEdges, visited) {
  if (visited.has(id)) return;
  visited.add(id);
  // Stop at join points so convergence nodes keep their default row
  if ((inEdges.get(id)?.length ?? 0) > 1) return;
  row.set(id, targetRow);
  const outs = outEdges.get(id) ?? [];
  if (outs.length === 1) {
    propagateLane(outs[0], targetRow, row, outEdges, inEdges, visited);
  }
}

/**
 * Computes auto-layout positions for each element based on graph structure.
 * Columns (X) are derived from a longest-path topological sort; rows (Y) are
 * assigned so that parallel branches are spread vertically and do not overlap.
 * @param {Array} elements
 * @param {Array} flows
 * @returns {Map<string, {x: number, y: number, width: number, height: number}>}
 */
function computeLayout(elements, flows = []) {
  const positions = new Map();
  if (elements.length === 0) return positions;

  // Build adjacency lists
  const outEdges = new Map(elements.map((el) => [el.id, []]));
  const inEdges = new Map(elements.map((el) => [el.id, []]));
  for (const flow of flows) {
    if (outEdges.has(flow.source) && inEdges.has(flow.target)) {
      outEdges.get(flow.source).push(flow.target);
      inEdges.get(flow.target).push(flow.source);
    }
  }

  // Topological sort (Kahn's algorithm)
  const indegree = new Map(elements.map((el) => [el.id, inEdges.get(el.id).length]));
  const queue = elements.filter((el) => indegree.get(el.id) === 0).map((el) => el.id);
  const topoOrder = [];
  const enqueued = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift();
    topoOrder.push(id);
    for (const next of outEdges.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0 && !enqueued.has(next)) {
        queue.push(next);
        enqueued.add(next);
      }
    }
  }
  // Append remaining nodes (disconnected or cyclic)
  for (const el of elements) {
    if (!enqueued.has(el.id)) topoOrder.push(el.id);
  }

  // Assign columns using longest-path from sources
  const col = new Map(elements.map((el) => [el.id, 0]));
  for (const id of topoOrder) {
    for (const next of outEdges.get(id)) {
      if (col.get(next) <= col.get(id)) {
        col.set(next, col.get(id) + 1);
      }
    }
  }

  // Assign rows for parallel branches
  const row = new Map(elements.map((el) => [el.id, 0]));
  for (const id of topoOrder) {
    const outs = outEdges.get(id);
    if (outs.length > 1) {
      const baseRow = row.get(id);
      const n = outs.length;
      const offset = Math.floor((n - 1) / 2);
      outs.forEach((target, i) => {
        propagateLane(target, baseRow + i - offset, row, outEdges, inEdges, new Set());
      });
    }
  }

  // Compute positions from column and row
  for (const el of elements) {
    const isGateway = el.type.toLowerCase().includes('gateway');
    const isEvent = el.type === 'startEvent' || el.type === 'endEvent';
    const width = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementWidth;
    const height = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementHeight;
    const x = LAYOUT.startX + col.get(el.id) * LAYOUT.stepX;
    const y = LAYOUT.startY + row.get(el.id) * LAYOUT.laneSpacing - height / 2;
    positions.set(el.id, { x, y, width, height });
  }

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
  const positions = computeLayout(data.elements, data.flows);

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
