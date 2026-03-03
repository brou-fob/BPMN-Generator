'use strict';

const express = require('express');
const path = require('path');
const { generate, changeElementType } = require('./bpmnGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/bpmn-js', express.static(
  path.join(__dirname, '..', 'node_modules', 'bpmn-js', 'dist')
));

/**
 * POST /api/generate
 *
 * Accepts a JSON body with the process definition and returns BPMN 2.0 XML.
 *
 * Request body format:
 * {
 *   "name": "My Process",
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
 * Response: BPMN 2.0 XML (Content-Type: application/xml)
 */
app.post('/api/generate', (req, res) => {
  try {
    const bpmnXml = generate(req.body);
    res.set('Content-Type', 'application/xml');
    res.send(bpmnXml);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/change-type
 *
 * Changes the type of an element in the process definition.
 *
 * Request body:
 * {
 *   "data": { <process definition> },
 *   "elementId": "task1",
 *   "newType": "userTask"
 * }
 *
 * Response: updated process definition JSON
 */
app.post('/api/change-type', (req, res) => {
  try {
    const { data, elementId, newType } = req.body;
    const updatedData = changeElementType(data, elementId, newType);
    res.json(updatedData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`BPMN Generator server running on http://localhost:${PORT}`);
});

module.exports = app;
