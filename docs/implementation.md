# Implementation

## Prepare data

Ingest input data and prepare internal representation, from a Nodes-Ways model to Nodes, Segments and Connections.

## Nodes creation

For each node :
- Determine node type from its properties and valency.
- Compute position and tangent for each connections
- Create shape

## Segments creation

For each segment :
- Create shapes interpolating between connections (start|end) respective position and tangent;