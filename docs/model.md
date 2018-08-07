# Model

## Input data

OSM style: Nodes and Ways.

```
InputTag{
	k: string;
	v string;
}
InputEntity { 
	id: number;
	tags: [Tag];
}
InputNode : Entity {
	lat: number;
	lon: number;
}
InputWay : Entity {
	refs: [Node];
}
```

## Internal representation
```
Pivot{
	position: Vec3;
	rotation: EulerXYZ;
}
Scope{
	position: Vec3;
	rotation: EulerXYZ;
	scale: Vec3;
}
Entity { 
	pivot: Pivot;
	scope: Scope;
}
RoadConnection {
	node: RoadNode;
	segment: RoadSegment;

	position: Vec3;
	tangent: Vec3;
}
RoadNode : Entity {
	connections: [RoadConnection];
}
RoadWay {
	nodes: [Node];
	segments: [RoadSegment];
}
RoadSegment: Entity {
	connections: [RoadConnection];
	way: RoadWay;
}
```