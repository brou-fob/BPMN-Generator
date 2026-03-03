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
  // Intermediate Catch Events
  intermediateTimerEvent: 'bpmn:intermediateCatchEvent',
  intermediateMessageEvent: 'bpmn:intermediateCatchEvent',
  intermediateSignalEvent: 'bpmn:intermediateCatchEvent',
  intermediateConditionalEvent: 'bpmn:intermediateCatchEvent',
  // Intermediate Throw Events
  intermediateThrowEvent: 'bpmn:intermediateThrowEvent',
  intermediateMessageThrowEvent: 'bpmn:intermediateThrowEvent',
  intermediateSignalThrowEvent: 'bpmn:intermediateThrowEvent',
  intermediateEscalationEvent: 'bpmn:intermediateThrowEvent',
  intermediateLinkEvent: 'bpmn:intermediateThrowEvent',
  // Boundary Events
  boundaryTimerEvent: 'bpmn:boundaryEvent',
  boundaryErrorEvent: 'bpmn:boundaryEvent',
  boundaryMessageEvent: 'bpmn:boundaryEvent',
  boundarySignalEvent: 'bpmn:boundaryEvent',
};

/**
 * Event definition child elements for intermediate and boundary events.
 * Maps each event type key to its BPMN 2.0 event definition tag.
 */
const EVENT_DEFINITIONS = {
  intermediateTimerEvent: 'bpmn:timerEventDefinition',
  intermediateMessageEvent: 'bpmn:messageEventDefinition',
  intermediateSignalEvent: 'bpmn:signalEventDefinition',
  intermediateConditionalEvent: 'bpmn:conditionalEventDefinition',
  intermediateMessageThrowEvent: 'bpmn:messageEventDefinition',
  intermediateSignalThrowEvent: 'bpmn:signalEventDefinition',
  intermediateEscalationEvent: 'bpmn:escalationEventDefinition',
  intermediateLinkEvent: 'bpmn:linkEventDefinition',
  boundaryTimerEvent: 'bpmn:timerEventDefinition',
  boundaryErrorEvent: 'bpmn:errorEventDefinition',
  boundaryMessageEvent: 'bpmn:messageEventDefinition',
  boundarySignalEvent: 'bpmn:signalEventDefinition',
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
  // Pool and lane layout constants
  poolStartX: 130,
  poolStartY: 80,
  poolHeaderWidth: 30,
  laneHeaderWidth: 30,
  laneHeight: 180,
  poolGap: 30,
  minPoolWidth: 600,
  poolContentPadding: 50,
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

  // Validate attachedToRef for boundary events (second pass after all ids are collected)
  for (const el of data.elements) {
    if (el.type.startsWith('boundary')) {
      if (!el.attachedToRef || !ids.has(el.attachedToRef)) {
        throw new Error(
          `Boundary event "${el.id}" must have an "attachedToRef" referencing a valid element id.`
        );
      }
    }
  }

  // Validate pools and lanes if present
  const laneIds = new Set();
  if (data.pools !== undefined) {
    if (!Array.isArray(data.pools)) {
      throw new Error('Field "pools" must be an array.');
    }
    const poolIds = new Set();
    for (const pool of data.pools) {
      if (!pool.id || typeof pool.id !== 'string') {
        throw new Error('Each pool must have a string "id".');
      }
      if (poolIds.has(pool.id)) {
        throw new Error(`Duplicate pool id "${pool.id}".`);
      }
      poolIds.add(pool.id);
      if (pool.lanes !== undefined) {
        if (!Array.isArray(pool.lanes)) {
          throw new Error(`Pool "${pool.id}" field "lanes" must be an array.`);
        }
        for (const lane of pool.lanes) {
          if (!lane.id || typeof lane.id !== 'string') {
            throw new Error('Each lane must have a string "id".');
          }
          if (laneIds.has(lane.id)) {
            throw new Error(`Duplicate lane id "${lane.id}".`);
          }
          laneIds.add(lane.id);
        }
      }
    }
  }
  // Validate element laneRef
  for (const el of data.elements) {
    if (el.laneRef !== undefined) {
      if (laneIds.size === 0) {
        throw new Error(
          `Element "${el.id}" has "laneRef" but no pools with lanes are defined.`
        );
      }
      if (!laneIds.has(el.laneRef)) {
        throw new Error(
          `Element "${el.id}" has laneRef "${el.laneRef}" referencing an unknown lane id.`
        );
      }
    }
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
    const isEvent = el.type.endsWith('Event');
    const width = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementWidth;
    const height = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementHeight;
    const x = LAYOUT.startX + col.get(el.id) * LAYOUT.stepX;
    const y = LAYOUT.startY + row.get(el.id) * LAYOUT.laneSpacing - height / 2;
    positions.set(el.id, { x, y, width, height });
  }

  return positions;
}

/**
 * Assigns column numbers to elements using a longest-path topological sort.
 * Used internally for pool-based layout.
 * @param {Array} elements
 * @param {Array} flows
 * @returns {Map<string, number>} element id → column index
 */
function computeColumns(elements, flows) {
  const outEdges = new Map(elements.map((el) => [el.id, []]));
  const inEdges = new Map(elements.map((el) => [el.id, []]));
  for (const flow of flows) {
    if (outEdges.has(flow.source) && inEdges.has(flow.target)) {
      outEdges.get(flow.source).push(flow.target);
      inEdges.get(flow.target).push(flow.source);
    }
  }
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
  for (const el of elements) {
    if (!enqueued.has(el.id)) topoOrder.push(el.id);
  }
  const col = new Map(elements.map((el) => [el.id, 0]));
  for (const id of topoOrder) {
    for (const next of outEdges.get(id)) {
      if (col.get(next) <= col.get(id)) {
        col.set(next, col.get(id) + 1);
      }
    }
  }
  return col;
}

/**
 * Computes layout positions for a pool-based process (with collaboration,
 * pools, and lanes). Each pool's elements are positioned within their
 * respective lane's Y band; columns are assigned by topological order within
 * each pool.
 *
 * @param {object} data - The structured process data (with pools).
 * @returns {{ positions: Map, poolShapes: Array }} Element positions and
 *   descriptors for pool/lane shapes to render in the diagram.
 */
function computePoolLayout(data) {
  const { poolStartX, poolStartY, poolHeaderWidth, laneHeaderWidth, laneHeight, poolGap, stepX } = LAYOUT;

  // Map lane id → pool
  const laneToPool = new Map();
  for (const pool of data.pools) {
    for (const lane of (pool.lanes || [])) {
      laneToPool.set(lane.id, pool);
    }
  }

  // Assign each element to a pool (via laneRef → lane → pool, else first pool)
  const elementToPoolId = new Map();
  for (const el of data.elements) {
    if (el.laneRef && laneToPool.has(el.laneRef)) {
      elementToPoolId.set(el.id, laneToPool.get(el.laneRef).id);
    } else {
      elementToPoolId.set(el.id, data.pools[0].id);
    }
  }

  // Partition elements and flows by pool
  const elementsByPool = new Map(data.pools.map((p) => [p.id, []]));
  for (const el of data.elements) {
    elementsByPool.get(elementToPoolId.get(el.id)).push(el);
  }
  const flowsByPool = new Map(data.pools.map((p) => [p.id, []]));
  for (const flow of data.flows) {
    const srcPool = elementToPoolId.get(flow.source);
    const tgtPool = elementToPoolId.get(flow.target);
    if (srcPool === tgtPool) {
      flowsByPool.get(srcPool).push(flow);
    }
  }

  const positions = new Map();
  const poolShapes = [];
  let currentY = poolStartY;

  for (const pool of data.pools) {
    const poolElements = elementsByPool.get(pool.id) || [];
    const poolFlows = flowsByPool.get(pool.id) || [];
    const lanes = pool.lanes || [];
    const hasLanes = lanes.length > 0;

    // Column assignment across all elements in this pool
    const col = computeColumns(poolElements, poolFlows);
    const maxCol = poolElements.length > 0 ? Math.max(...poolElements.map((el) => col.get(el.id))) : 0;

    // Content area starts after pool header (and lane header if lanes exist)
    const contentStartX = poolStartX + poolHeaderWidth + (hasLanes ? laneHeaderWidth : 0);

    // Pool/lane dimensions
    const poolContentWidth = (maxCol + 1) * stepX + LAYOUT.poolContentPadding;
    const poolWidth = poolHeaderWidth + (hasLanes ? laneHeaderWidth : 0) + poolContentWidth;
    const poolHeight = hasLanes ? lanes.length * laneHeight : laneHeight;

    // Lane Y positions
    const laneYMap = new Map();
    lanes.forEach((lane, i) => laneYMap.set(lane.id, currentY + i * laneHeight));

    // Position each element centred vertically within its lane band
    for (const el of poolElements) {
      const isGateway = el.type.toLowerCase().includes('gateway');
      const isEvent = el.type.endsWith('Event');
      const width = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementWidth;
      const height = isGateway ? LAYOUT.gatewaySize : isEvent ? LAYOUT.eventSize : LAYOUT.elementHeight;
      const x = contentStartX + col.get(el.id) * stepX;
      const bandY = (el.laneRef && laneYMap.has(el.laneRef)) ? laneYMap.get(el.laneRef) : currentY;
      const y = bandY + laneHeight / 2 - height / 2;
      positions.set(el.id, { x, y, width, height });
    }

    // Lane shape descriptors
    const laneShapes = lanes.map((lane, i) => ({
      lane,
      x: poolStartX + poolHeaderWidth,
      y: currentY + i * laneHeight,
      width: poolWidth - poolHeaderWidth,
      height: laneHeight,
    }));

    poolShapes.push({
      pool,
      x: poolStartX,
      y: currentY,
      width: poolWidth,
      height: poolHeight,
      laneShapes,
      poolElements,
      poolFlows,
    });

    currentY += poolHeight + poolGap;
  }

  // Normalise all pool widths to the widest pool for a uniform appearance
  const maxWidth = Math.max(...poolShapes.map((ps) => ps.width), LAYOUT.minPoolWidth);
  for (const ps of poolShapes) {
    ps.width = maxWidth;
    for (const ls of ps.laneShapes) {
      ls.width = maxWidth - LAYOUT.poolHeaderWidth;
    }
  }

  return { positions, poolShapes };
}

/**
 * Generates a BPMN 2.0 XML string for a pool/lane-based process.
 * Called internally by generate() when the input defines pools.
 *
 * @param {object} data - The structured process data (validated, with pools).
 * @returns {string} BPMN 2.0 XML string including collaboration and lane sets.
 */
function generateWithPools(data) {
  const collaborationId = 'Collaboration_1';
  const { positions, poolShapes } = computePoolLayout(data);

  // Collaboration participants
  const participantLines = poolShapes.map((ps) => {
    const { pool } = ps;
    const processId = `Process_${pool.id}`;
    const name = pool.name ? ` name="${escapeXml(pool.name)}"` : '';
    return `    <bpmn:participant id="${escapeXml(pool.id)}"${name} processRef="${processId}" />`;
  });

  // One bpmn:process per pool
  const processBlocks = poolShapes.map((ps) => {
    const { pool, poolElements, poolFlows } = ps;
    const processId = `Process_${pool.id}`;
    const lanes = pool.lanes || [];

    const elementLines = poolElements.map((el) => {
      const tag = ELEMENT_TYPES[el.type];
      const name = el.name ? ` name="${escapeXml(el.name)}"` : '';
      const attachedToRef = el.attachedToRef ? ` attachedToRef="${escapeXml(el.attachedToRef)}"` : '';
      const eventDef = EVENT_DEFINITIONS[el.type];
      if (eventDef) {
        return `    <${tag} id="${escapeXml(el.id)}"${name}${attachedToRef}>\n      <${eventDef} />\n    </${tag}>`;
      }
      return `    <${tag} id="${escapeXml(el.id)}"${name}${attachedToRef} />`;
    });

    const flowLines = poolFlows.map((flow) => {
      const name = flow.name ? ` name="${escapeXml(flow.name)}"` : '';
      return `    <bpmn:sequenceFlow id="${escapeXml(flow.id)}" sourceRef="${escapeXml(flow.source)}" targetRef="${escapeXml(flow.target)}"${name} />`;
    });

    let laneSetXml = '';
    if (lanes.length > 0) {
      const laneLines = lanes.map((lane) => {
        const laneName = lane.name ? ` name="${escapeXml(lane.name)}"` : '';
        const assignedEls = poolElements.filter((el) => el.laneRef === lane.id);
        const refs = assignedEls
          .map((el) => `      <bpmn:flowNodeRef>${escapeXml(el.id)}</bpmn:flowNodeRef>`)
          .join('\n');
        return `    <bpmn:lane id="${escapeXml(lane.id)}"${laneName}>\n${refs}\n    </bpmn:lane>`;
      });
      laneSetXml = `\n  <bpmn:laneSet id="LaneSet_${escapeXml(pool.id)}">\n${laneLines.join('\n')}\n  </bpmn:laneSet>`;
    }

    return `  <bpmn:process id="${processId}" name="${escapeXml(pool.name || data.name)}" isExecutable="false">${laneSetXml}
${elementLines.join('\n')}
${flowLines.join('\n')}
  </bpmn:process>`;
  });

  // Diagram shapes (pool → lane → element) and edges
  const diagramShapeLines = [];
  const diagramEdgeLines = [];

  for (const ps of poolShapes) {
    const { pool, laneShapes, poolElements, poolFlows } = ps;

    // Pool shape
    diagramShapeLines.push(
      `      <bpmndi:BPMNShape id="${escapeXml(pool.id)}_di" bpmnElement="${escapeXml(pool.id)}" isHorizontal="true">
        <dc:Bounds x="${ps.x}" y="${ps.y}" width="${ps.width}" height="${ps.height}" />
      </bpmndi:BPMNShape>`
    );

    // Lane shapes
    for (const ls of laneShapes) {
      diagramShapeLines.push(
        `      <bpmndi:BPMNShape id="${escapeXml(ls.lane.id)}_di" bpmnElement="${escapeXml(ls.lane.id)}" isHorizontal="true">
        <dc:Bounds x="${ls.x}" y="${ls.y}" width="${ls.width}" height="${ls.height}" />
      </bpmndi:BPMNShape>`
      );
    }

    // Element shapes
    for (const el of poolElements) {
      const pos = positions.get(el.id);
      if (!pos) continue;
      const isGateway = el.type.toLowerCase().includes('gateway');
      const isEvent = el.type.endsWith('Event');
      const label = isGateway || isEvent ? '' : `\n        <bpmndi:BPMNLabel />`;
      diagramShapeLines.push(
        `      <bpmndi:BPMNShape id="${escapeXml(el.id)}_di" bpmnElement="${escapeXml(el.id)}">
        <dc:Bounds x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${pos.height}" />${label}
      </bpmndi:BPMNShape>`
      );
    }

    // Flow edges (within pool)
    for (const flow of poolFlows) {
      const srcPos = positions.get(flow.source);
      const tgtPos = positions.get(flow.target);
      if (!srcPos || !tgtPos) continue;
      const srcMidX = srcPos.x + srcPos.width;
      const srcMidY = srcPos.y + srcPos.height / 2;
      const tgtMidX = tgtPos.x;
      const tgtMidY = tgtPos.y + tgtPos.height / 2;
      diagramEdgeLines.push(
        `      <bpmndi:BPMNEdge id="${escapeXml(flow.id)}_di" bpmnElement="${escapeXml(flow.id)}">
        <di:waypoint x="${srcMidX}" y="${srcMidY}" />
        <di:waypoint x="${tgtMidX}" y="${tgtMidY}" />
      </bpmndi:BPMNEdge>`
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="${collaborationId}">
${participantLines.join('\n')}
  </bpmn:collaboration>
${processBlocks.join('\n')}
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${collaborationId}">
${diagramShapeLines.join('\n')}
${diagramEdgeLines.join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
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
 * Optionally, pools and lanes can be defined:
 * {
 *   "pools": [
 *     { "id": "pool1", "name": "Customer", "lanes": [
 *         { "id": "lane1", "name": "Sales" },
 *         { "id": "lane2", "name": "Operations" }
 *     ]}
 *   ],
 *   ...
 * }
 * Elements can reference a lane via "laneRef": "lane1".
 *
 * @param {object} data - The structured process data.
 * @returns {string} BPMN 2.0 XML string.
 */
function generate(data) {
  validate(data);

  if (Array.isArray(data.pools) && data.pools.length > 0) {
    return generateWithPools(data);
  }

  const processId = 'Process_1';
  const positions = computeLayout(data.elements, data.flows);

  // Build process elements XML
  const elementLines = data.elements.map((el) => {
    const tag = ELEMENT_TYPES[el.type];
    const name = el.name ? ` name="${escapeXml(el.name)}"` : '';
    const attachedToRef = el.attachedToRef ? ` attachedToRef="${escapeXml(el.attachedToRef)}"` : '';
    const eventDef = EVENT_DEFINITIONS[el.type];
    if (eventDef) {
      return `    <${tag} id="${escapeXml(el.id)}"${name}${attachedToRef}>\n      <${eventDef} />\n    </${tag}>`;
    }
    return `    <${tag} id="${escapeXml(el.id)}"${name}${attachedToRef} />`;
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
    const isEvent = el.type.endsWith('Event');
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

/**
 * Changes the type of an element within the process data.
 * @param {object} data - The structured process data.
 * @param {string} elementId - The id of the element whose type should change.
 * @param {string} newType - The new element type key (must be a key of ELEMENT_TYPES).
 * @returns {object} A new process data object with the element type updated.
 * @throws {Error} if newType is unsupported or elementId is not found.
 */
function changeElementType(data, elementId, newType) {
  validate(data);
  if (!newType || !ELEMENT_TYPES[newType]) {
    throw new Error(
      `Unknown type "${newType}". Supported types: ${Object.keys(ELEMENT_TYPES).join(', ')}.`
    );
  }
  const elementIndex = data.elements.findIndex((el) => el.id === elementId);
  if (elementIndex === -1) {
    throw new Error(`Element "${elementId}" not found.`);
  }
  const updatedElements = data.elements.map((el, i) =>
    i === elementIndex ? { ...el, type: newType } : el
  );
  return { ...data, elements: updatedElements };
}

module.exports = { generate, validate, changeElementType, ELEMENT_TYPES, EVENT_DEFINITIONS };
