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

/**
 * POST /api/copilot
 *
 * Accepts a natural-language prompt and the current process definition JSON.
 * Uses the OpenAI API (requires OPENAI_API_KEY env var) to return an updated
 * process definition.
 *
 * Request body:
 * {
 *   "prompt": "Add a parallel gateway after task1",
 *   "currentData": { <process definition> }
 * }
 *
 * Response: { "updatedData": <updated process definition> }
 */
app.post('/api/copilot', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'CoPilot nicht verfügbar: OPENAI_API_KEY ist nicht konfiguriert.',
    });
  }

  const { prompt, currentData } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Kein Prompt angegeben.' });
  }
  if (!currentData || typeof currentData !== 'object') {
    return res.status(400).json({ error: 'Fehlende Prozessdefinition (currentData).' });
  }

  const systemPrompt = `You are a BPMN process modelling assistant.
The user will describe changes to make to a process definition in JSON format.
You must return ONLY the modified JSON object — no markdown, no explanation, no code fences.

The JSON has this structure:
{
  "name": "string",
  "elements": [{ "id": "string", "type": "string", "name": "string", "x?": number, "y?": number }],
  "flows": [{ "id": "string", "source": "string", "target": "string", "name?": "string" }]
}

Valid element types: startEvent, endEvent, task, userTask, serviceTask, exclusiveGateway,
parallelGateway, inclusiveGateway, intermediateTimerEvent, intermediateMessageEvent,
intermediateSignalEvent, intermediateConditionalEvent, intermediateThrowEvent,
intermediateMessageThrowEvent, intermediateSignalThrowEvent, intermediateEscalationEvent,
intermediateLinkEvent, boundaryTimerEvent, boundaryErrorEvent, boundaryMessageEvent,
boundarySignalEvent.

Return the complete updated JSON object.`;

  try {
    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Current process definition:\n${JSON.stringify(currentData, null, 2)}\n\nRequested change: ${prompt}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!openAiRes.ok) {
      const errBody = await openAiRes.json().catch(() => ({}));
      return res.status(502).json({
        error: 'OpenAI-Fehler: ' + (errBody.error?.message || openAiRes.statusText),
      });
    }

    const completion = await openAiRes.json();
    const rawContent = completion.choices?.[0]?.message?.content ?? '';

    let updatedData;
    try {
      updatedData = JSON.parse(rawContent);
    } catch {
      return res.status(502).json({
        error: 'CoPilot hat kein gültiges JSON zurückgegeben. Bitte versuchen Sie es erneut.',
      });
    }

    res.json({ updatedData });
  } catch (err) {
    res.status(502).json({ error: 'Fehler beim Kontaktieren des CoPilot-Dienstes: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`BPMN Generator server running on http://localhost:${PORT}`);
});

module.exports = app;
