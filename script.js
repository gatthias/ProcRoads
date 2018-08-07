var data = {};

data.nodes = [
    {
        id: 0,
        location: new THREE.Vector2(-10, 0),

    },
    {
        id: 1,
        location: new THREE.Vector2(0, 0),

    },
    {
        id: 2,
        location: new THREE.Vector2(10, 10),

    },
    {
        id: 3,
        location: new THREE.Vector2(20, 10),

    },
    {
        id: 4,
        location: new THREE.Vector2(0, -15),

    }
];

data.ways = [
    {
        id: 0,
        nodeRefs: [0, 1, 2, 3]
    },
    {
        id: 1,
        nodeRefs: [1, 4]
    }
];

function getNodeById(id) {
    var node;
    for (var i = 0; i < data.nodes.length; ++i) {
        if (data.nodes[i].id == id)
            return data.nodes[i];
    }
    return null;
}
function getWayById(id) {
    for (var i = 0; i < data.ways.length; ++i) {
        if (data.ways[i].id == id)
            return data.ways[i];
    }
    return null;
}

class Pivot {
    constructor() {
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
    }
}

class Scope {
    constructor() {
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler(0, 0, 0, 'XYZ');
        this.scale = new THREE.Vector3();
    }
}

class Entity {
    constructor() {
        this.pivot = new Pivot();
        this.scope = new Scope();
    }
}

class Rect extends Entity {
    constructor(length, width) {
        super();

        this.length = length;
        this.width = width;

        this.updateScope();
    }

    fromPointsAndWidth(start, end, width) {
        this.length = end.clone().sub(start).length();
        this.width = width;

        var tan = new THREE.Vector3().subVectors(end, start);
        tan.normalize();
        var up = new THREE.Vector3(0, 1, 0);
        var bitan = new THREE.Vector3().crossVectors(tan, up);

        this.pivot.position.copy(start).sub(bitan.clone().multiplyScalar(width / 2));

        // Look at
        var m1 = new THREE.Matrix4();
        m1.lookAt(start, end, up);

        var m2 = new THREE.Matrix4();
        m2.makeRotationFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ'));
        
        this.pivot.rotation.setFromRotationMatrix(m1.multiply(m2));
        this.updateScope();

        return this;
    }

    updateScope() {
        this.scope.scale.set(this.width, this.length, 0);
    }

    addToGeom(geom) {
        
        var v1 = this.pivot.position.clone();
        var v2 = this.pivot.position.clone().add(new THREE.Vector3(this.width, 0, 0).applyEuler(this.pivot.rotation));
        var v3 = this.pivot.position.clone().add(new THREE.Vector3(this.width, this.length, 0).applyEuler(this.pivot.rotation));
        var v4 = this.pivot.position.clone().add(new THREE.Vector3(0, this.length, 0).applyEuler(this.pivot.rotation));

        geom.vertices.push(v1);
        geom.vertices.push(v2);
        geom.vertices.push(v3);
        geom.vertices.push(v4);

        geom.faces.push(new THREE.Face3(0, 1, 2));
        geom.faces.push(new THREE.Face3(0, 2, 3));
        
    }
}



class RoadConnection {
    constructor(node, segment) {
        this.position = new THREE.Vector3();
        this.tangent = new THREE.Vector3();

        this.node = node;
        this.segment = segment;
    }

    getSegmentOppositeSideConnection() {
        var idx = this.segment.connections[0] == this ? 1 : 0;
        return this.segment.connections[idx];
    }

    getNodePrevConnection() {
        // XY CCW oriented
        var sorted = this.node.getConnectionsCCW();
        var idx = sorted.indexOf(this);
        --idx;

        if (idx == -1) idx = sorted.length - 1;

        return sorted[idx];
    }

    getNodeNextConnection() {
        // XY CCW oriented
        var sorted = this.node.getConnectionsCCW();
        var idx = sorted.indexOf(this);
        ++idx;

        if (idx > sorted.length - 1) idx = 0;

        return sorted[idx];
    }


}

class RoadNode {
    constructor(store) {
        this.store = store;

        this.init();
    }

    init() {
        this.position = new THREE.Vector3();
        this.connections = [];


        /** Params */
        this.minArcRadius = 0;

        this.shapes = [];


        this.inputNode = null;

        return this;
    }

    fromInputNode(inputNode) {
        this.init();

        this.position.copy(new THREE.Vector3(inputNode.location.x * 100, 0, inputNode.location.y * 100));

        this.inputNode = inputNode;

        return this;
    }

    createShapes(material) {
        this.shapes = [];

        var valency = this.valency;

        if (valency <= 0) {
            return;
        } else if (valency == 1) {
            // Dead-End

        } else if (valency == 2) {
            // Joint
            var info = this.getAdjacentConnectionsGeometryInfo(this.connections[0], this.connections[1]);

            var startConn = this.connections[0];
            var endConn = this.connections[1];

            var start = startConn.position;
            var end = endConn.position;

            var up = new THREE.Vector3(0, 1, 0);
            var startBitan = new THREE.Vector3().crossVectors(startConn.tangent.clone(), up);
            startBitan.normalize();
            var endBitan = new THREE.Vector3().crossVectors(endConn.tangent.clone(), up);
            endBitan.normalize();

            var shape = new THREE.Shape();

            var startLeft = start.clone().sub(startBitan.clone().multiplyScalar(startConn.segment.width / 2));
            var startRight = start.clone().add(startBitan.clone().multiplyScalar(startConn.segment.width / 2));
            var endRight = end.clone().add(endBitan.clone().multiplyScalar(endConn.segment.width / 2));
            var endLeft = end.clone().sub(endBitan.clone().multiplyScalar(endConn.segment.width / 2));

            if (info.sign == 1) {
                // Intersection = StartRight = EndLeft
                endLeft = startRight;

                shape.moveTo(-startRight.x, startRight.z);
                shape.lineTo(-startLeft.x, startLeft.z);
                shape.lineTo(-endRight.x, endRight.z);

                shape.lineTo(-endLeft.x, endLeft.z);

            } else {
                // Intersection = StartLeft = EndRight
                endRight = startLeft;

                shape.moveTo(-endRight.x, endRight.z);
                shape.lineTo(-endLeft.x, endLeft.z);
                //shape.lineTo(-startRight.x, startRight.z);

                var cp1 = endLeft.clone().add(endConn.tangent.clone().normalize().multiplyScalar(-endConn.segment.width / Math.sqrt(2) * (1 - Math.cos(Math.PI - info.angle))));
                var cp2 = startRight.clone().add(startConn.tangent.clone().normalize().multiplyScalar(-startConn.segment.width / Math.sqrt(2) * (1 - Math.cos(Math.PI - info.angle))));
                shape.bezierCurveTo(-cp1.x, cp1.z, -cp2.x, cp2.z, -startRight.x, startRight.z);

                shape.lineTo(-startLeft.x, startLeft.z);
            }

            var geometry = new THREE.ShapeGeometry(shape);
            var mesh = new THREE.Mesh(geometry);//, material);
            mesh.position.copy(this.position);
            mesh.rotateX(-Math.PI / 2);
            mesh.rotateZ(-Math.PI);
            this.shapes.push(mesh);

            var showGrid = true;
            if (showGrid) {
                var wire_material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
                var wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), wire_material);
                //var wireframe = new THREE.LineSegments( new THREE.WireframeGeometry(r), wire_material );
                wireframe.position.copy(this.position);
                wireframe.rotateX(-Math.PI / 2);
                wireframe.rotateZ(-Math.PI);

                this.shapes.push(wireframe);
            }

            return this.shapes;

            //// Mirror forward or backward
            //var angleMirrorFwd = Math.atan(startWidth / (dist * Math.cos(angleFromEnd)));
            //var angleMirrorBck = Math.atan(endWidth / (dist * Math.cos(angleFromStart)));

            //if (angleFromStart > angleMirrorFwd) {
            //    // Mirror forward

            //}

            //if (angleFromEnd > angleMirrorBck) {
            //    // Mirror backward

            //}

            //if (this.minArcRadius == 0) {

            //} else {

            //}

        } else if (valency >= 2) {
            // Intersection
            var sorted = this.getConnectionsCCW();

            var contour = sorted.map(conn => {
                var up = new THREE.Vector3(0, 1, 0);
                var bitan = new THREE.Vector3().crossVectors(conn.tangent.clone(), up);
                bitan.normalize();

                return [
                    conn.position.clone().sub(bitan.clone().multiplyScalar(conn.segment.width/2)),
                    conn.position.clone().add(bitan.clone().multiplyScalar(conn.segment.width/2)),
                ];
            }).reduce((cur, sel) => cur.concat(sel), []);

            var shape = new THREE.Shape();

            contour.map((pt, i) => {
                if (i == 0) {
                    shape.moveTo(-pt.x, pt.z);
                } else {
                    if (i % 2 == 0) {
                        shape.lineTo(-pt.x, pt.z);
                    } else {
                        shape.lineTo(-pt.x, pt.z);
                    }
                }
                if (i == contour.length - 1) {
                    shape.lineTo(-contour[0].x, contour[0].z);
                }
            })
            

            var geometry = new THREE.ShapeGeometry(shape);
            var mesh = new THREE.Mesh(geometry);//, material);
            mesh.position.copy(this.position);
            mesh.rotateX(-Math.PI / 2);
            mesh.rotateZ(-Math.PI);
            this.shapes.push(mesh);

            var showGrid = true;
            if (showGrid) {
                var wire_material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
                var wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), wire_material);
                //var wireframe = new THREE.LineSegments( new THREE.WireframeGeometry(r), wire_material );
                wireframe.position.copy(this.position);
                wireframe.rotateX(-Math.PI / 2);
                wireframe.rotateZ(-Math.PI);

                this.shapes.push(wireframe);
            }

            return this.shapes;
        }
    }

    getShapes(material) {
        if (this.shapes.length == 0) this.createShapes(material);
        return this.shapes;
    }

    updateConnections(autoCalcTangents) {
        var valency = this.valency;

        if (valency <= 0) {
            return;
        } else if (valency == 1) {
            // Dead-End

        } else if (valency == 2) {
            // Joint
            var startConn = this.connections[0];
            var endConn = this.connections[1];

            var info = this.getAdjacentConnectionsGeometryInfo(startConn, endConn);

            if (autoCalcTangents) {
                startConn.tangent.copy(info.start.tangent);
                endConn.tangent.copy(info.end.tangent);
            }

            startConn.position.copy(info.start.tangent.clone().multiplyScalar(info.intersection.startOffset));
            endConn.position.copy(info.end.tangent.clone().multiplyScalar(info.intersection.endOffset));
        } else if (valency > 2) {
            // Intersection
            var sorted = this.getConnectionsCCW();

            sorted.map(startConn => {
                var prev = startConn.getNodePrevConnection();
                var next = startConn.getNodeNextConnection();

                var infos = [prev, next].map(endConn => this.getAdjacentConnectionsGeometryInfo(startConn, endConn));
                
                var end = infos[0].intersection.startOffset > infos[1].intersection.startOffset ? prev : next;
                var info = infos[0].intersection.startOffset > infos[1].intersection.startOffset ? infos[0] : infos[1];

                if (autoCalcTangents) {
                    startConn.tangent.copy(info.start.tangent);
                }

                startConn.position.copy(info.start.tangent.clone().multiplyScalar(info.intersection.startOffset));
            });
        }
    }

    get valency() {
        return this.connections.length;
    }

    //getConnectionsCCW() {
    //    return this.connections.sort((a, b) => {
    //        var aTan, bTan;
    //        aTan = a.segment.getNaturalTangent(a);
    //        bTan = b.segment.getNaturalTangent(b);

    //        var abAngle = Math.atan2(bTan.z - aTan.z, bTan.x - aTan.x);
    //        if (abAngle > 0) {
    //            return 1;
    //        } else if (abAngle < 0) {
    //            return -1;
    //        } else {
    //            return 0;
    //        }
    //    });
    //}

    getConnectionsCCW() {
        return this.connections.sort((a, b) => {
            var aTan, bTan;
            aTan = a.segment.getNaturalTangent(a);
            bTan = b.segment.getNaturalTangent(b);

            var aAngle = Math.atan2(aTan.z, aTan.x);
            var bAngle = Math.atan2(bTan.z, bTan.x);

            //var abAngle = Math.atan2(bTan.z - aTan.z, bTan.x - aTan.x);
            var abAngle = aAngle - bAngle;
            if (abAngle > 0) {
                return 1;
            } else if (abAngle < 0) {
                return -1;
            } else {
                return 0;
            }
        });
    }

    getAdjacentConnectionsGeometryInfo(startConn, endConn) {
        var startTan = startConn.segment.getNaturalTangent(startConn);
        var endTan = endConn.segment.getNaturalTangent(endConn);

        // Get closest intersection point
        var startWidth = startConn.segment.width;
        var endWidth = endConn.segment.width;

        var startAngle = Math.atan2(startTan.z, startTan.x);
        var endAngle = Math.atan2(endTan.z, endTan.x);

        //var seAngle = Math.atan2(- endConn.tangent.z - startConn.tangent.z, - endConn.tangent.x - startConn.tangent.x);

        var iStartAngle = startAngle + Math.PI;
        if (iStartAngle > Math.PI) {
            iStartAngle -= 2 * Math.PI;
        }

        var sign = iStartAngle > endAngle ? 1 : -1;
        var seAngle = Math.abs(startAngle - endAngle);
        
        if (seAngle > Math.PI) {
            seAngle = 2 * Math.PI - seAngle;
        }

        var widthRatio = (startWidth / endWidth);

        var angleFromStart = Math.atan(widthRatio * Math.sin(seAngle) / (1 + widthRatio * Math.cos(seAngle)));
        var angleFromEnd = seAngle - angleFromStart;
        var dist = (startWidth / 2) / Math.sin(angleFromStart);

        var intersectPoint = new THREE.Vector3(
            dist * Math.cos(angleFromStart),
            0,
            dist * Math.sin(angleFromStart)
        );

        var startOffset = Math.sqrt(dist * dist - startWidth * startWidth / 4);
        var endOffset = Math.sqrt(dist * dist - endWidth * endWidth / 4);

        return {
            start: {
                tangent: startTan,
                width: startWidth,
                angle: startAngle
            },
            end: {
                tangent: endTan,
                width: endWidth,
                angle: endAngle
            },
            angle: seAngle,
            sign: sign,
            widthRatio: widthRatio,
            intersection: {
                angleFromStart: angleFromStart,
                angleFromEnd: angleFromEnd,
                dist: dist,
                startOffset: startOffset,
                endOffset: endOffset,
                position: intersectPoint
            }
        }
    }
}

class RoadWay {
    constructor(store) {
        this.store = store;

        this.init();
    }

    init() {
        this.nodes = [];

        this.segments = [];

        this.inputWay = null;

        return this;
    }

    fromInputWay(inputWay) {
        this.inputWay = inputWay;

        this.nodes = inputWay.nodeRefs.map(nd => this.store.getNode(nd));

        this.nodes.map((node, i) => {
            if (i < this.nodes.length - 1) {
                this.store.createSegmentForWay(node, this.nodes[i + 1], this);
            }
        })

        return this;
    }
}

class RoadSegment {
    constructor(/* ..., */ roadWay) {
        this.init(roadWay);
    }

    init(roadWay) {
        this.connections = [];

        this.way = roadWay;

        this.width = (roadWay || {}).width || 100;
        this.shapes = [];

        return this;
    }

    createShapes(material) {
        this.shapes = [];
        

        var start = this.connections[0].node.position.clone().add(this.connections[0].position);
        var end = this.connections[1].node.position.clone().add(this.connections[1].position);


        var rect = new Rect().fromPointsAndWidth(start, end, this.width);

        var geom = new THREE.Geometry();

        rect.addToGeom(geom);

        geom.computeFaceNormals();

        var object = new THREE.Mesh(geom, material);

        this.shapes.push(object);

        var showGrid = true;
        if (showGrid) {
            var wire_material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
            var wireframe = new THREE.LineSegments(new THREE.EdgesGeometry(geom), wire_material);

            this.shapes.push(wireframe);
        }
    }

    getShapes(material) {
        if (this.shapes.length == 0) this.createShapes(material);
        return this.shapes;
    }

    getNaturalTangent(conn) {
        var start = this.connections[0].node.position.clone();
        var end = this.connections[1].node.position.clone();
        var tan = end.clone().sub(start).normalize();

        if (this.connections[1] == conn) {
            tan.multiplyScalar(-1);
        }

        return tan;
    }
}

class HashMap {
    constructor() {

    }

    toArray() {
        return Object.keys(this).map(k => {
            if (this.hasOwnProperty(k)) {
                return this[k];
            }
        }).filter(d => d != null);
    }
}
class RoadDataStore {
    constructor() {
        this.nodes = [];
        this.ways = [];
        this.segments = [];
    }

    initFromInputData(data) {

        data.nodes.map(inputNode => {
            var node = new RoadNode(this).fromInputNode(inputNode);

            this.nodes.push(node);
        });

        data.ways.map(inputWay => {
            var way = new RoadWay(this).fromInputWay(inputWay);

            this.ways.push(way);
        });

        this.nodes.map(node => {
            node.updateConnections(true);
        });

        return this;
    }

    getNode(id) {
        var node;
        for (var i = 0; i < this.nodes.length; ++i) {
            if (this.nodes[i].inputNode.id == id)
                return this.nodes[i];
        }
        return null;
    }
    getWay(id) {
        for (var i = 0; i < this.ways.length; ++i) {
            if (this.ways[i].inputWay.id == id)
                return this.ways[i];
        }
        return null;
    }

    createSegmentForWay(startNode, endNode, way) {
        var segment = new RoadSegment(way);

        // Connect
        var startConn = new RoadConnection(startNode, segment);
        segment.connections.push(startConn);
        startNode.connections.push(startConn);

        var endConn = new RoadConnection(endNode, segment);
        segment.connections.push(endConn);
        endNode.connections.push(endConn);

        way.segments.push(segment);
        this.segments.push(segment);

        return segment;
    }
}

class ProcRoadApp {

    //camera;
    //scene;
    //renderer;
    //geometry;
    //material;
    //mesh;

    //controls;

    constructor() {
        this.mouse = new THREE.Vector2();
        this.RAYCAST_INTERSECTED = null;
    }

    init() {
        // Set up vector as Z
        //THREE.Object3D.DefaultUp = new THREE.Vector3(0, 0, 1);//.ZAxis.clone();

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);
        this.camera.position.z = 500;
        this.scene.add(this.camera);

        this.nodePlaceholderGeometry = new THREE.CubeGeometry(10, 10, 10);
        this.baseMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x757575) });//new THREE.MeshNormalMaterial();

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this.renderer.domElement);

        var size = 500;
        var divisions = 30;

        this.gridHelper = new THREE.GridHelper(size, divisions);
        this.scene.add(this.gridHelper);

        var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = false;
        controls.minDistance = 100;
        controls.maxDistance = 50000;
        //controls.maxPolarAngle = Math.PI / 2;

        this.controls = controls;

        this.raycaster = new THREE.Raycaster();

        this.initNodesAndWays();

        var objects = this.scene.children.filter(o => o.userData.dataId != null);

        this.dragControls = new THREE.DragControls(objects, this.camera, this.renderer.domElement);
        this.dragControls.addEventListener('dragstart', (event) => {
            event.object.position.y = 0;
            controls.enabled = false;
        });
        this.dragControls.addEventListener('drag', (event) => {
            event.object.position.y = 0;

            var nodeId = event.object.userData.dataId.slice(2);
            var node = this.store.getNode(nodeId);

            this.updateNode(node, event.object);
        });
        this.dragControls.addEventListener('dragend', (event) => {
            event.object.position.y = 0;
            controls.enabled = true;


            var nodeId = event.object.userData.dataId.slice(2);
            var node = this.store.getNode(nodeId);

            this.updateNode(node, event.object);
        });


        document.addEventListener('mousemove', e => this.onDocumentMouseMove(e), false);
        document.addEventListener('click', e => this.onDocumentMouseClick(e), false);
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    updateNode(node, gizmo) {
        if (!node || !gizmo) return;

        node.position.copy(gizmo.position);

        var shapesToUpdate = [];
        shapesToUpdate = shapesToUpdate.concat(node.shapes);

        node.connections.map(conn => shapesToUpdate = shapesToUpdate.concat(conn.segment.shapes));

        shapesToUpdate.map(o => {
            o.geometry.dispose();
            this.scene.remove(o);
        });

        node.shapes = [];
        node.connections.map(conn => conn.segment.shapes = []);

        node.updateConnections(true);

        var shapesToAdd = [];
        shapesToAdd = shapesToAdd.concat(node.getShapes(this.baseMaterial));
        node.connections.map(conn => shapesToAdd = shapesToAdd.concat(conn.segment.getShapes(this.baseMaterial)));

        shapesToAdd.map(s => this.scene.add(s));
    }

    initNodesAndWays() {
        this.store = new RoadDataStore().initFromInputData(data);


        this.store.nodes.map(node => {
            // Create node representation
            var mesh = this.createNodeCube(node);
            this.scene.add(mesh);

            // Create shapes
            var shapes = node.getShapes(this.baseMaterial);

            shapes.map(s => this.scene.add(s));
        });

        this.store.segments.map(segment => {
            var shapes = segment.getShapes(this.baseMaterial);

            shapes.map(s => this.scene.add(s));
        });


        // Link nodes & ways
        /*
        data.ways.map(way => {
            way.nodes = way.nodeRefs.map(nd => {
                var node = getNodeById(nd);
                if (node) {
                    node.valence = node.valence || 0;
                    node.valence++;

                    node.wayRefs = node.wayRefs || [];
                    node.wayRefs.push({ way: way });
                } else {
                    throw new Error("Bad graph connectivity, missing node " + nd);
                }
                return node;
            });
        })

        this.nodesPlaceholders = data.nodes.map(n => {
            var mesh = this.createNodeCube(n);
            this.scene.add(mesh);

            return mesh;
        });

        this.waysPlaceholders = data.ways.map(way => {
            way.segments = [];

            way.nodes.map((n, i) => {
                if (i < way.nodes.length - 1) {
                    var segment = this.createSegmentMesh(way.nodes[i], way.nodes[i + 1]);

                    this.scene.add(segment);

                    way.segments.push(segment);
                }
            })
            
            
        });

        */
    }

    createNodeCube(node) {
        var mesh = new THREE.Mesh(this.nodePlaceholderGeometry, new THREE.MeshNormalMaterial());

        mesh.position.copy(node.position);
        //mesh.position.x = node.location.x * 100;
        //mesh.position.y = 5;
        //mesh.position.z = node.location.y * 100;

        mesh.userData.dataId = "n-"+node.inputNode.id;

        return mesh;
    }

    createSegmentMesh(cur, next) {
        var width = 100;

        var unitScale = 100;
        var start = new THREE.Vector3(cur.location.x * unitScale, 0, cur.location.y * unitScale);
        var end = new THREE.Vector3(next.location.x * unitScale, 0, next.location.y * unitScale);


        var rect = new Rect().fromPointsAndWidth(start, end, width);

        var geom = new THREE.Geometry();

        rect.addToGeom(geom);

        geom.computeFaceNormals();


        var axesHelper = new THREE.AxesHelper(5);
        axesHelper.position.copy(rect.pivot.position);
        axesHelper.setRotationFromEuler(rect.pivot.rotation);
        this.scene.add(axesHelper);



        //var tan = new THREE.Vector3().subVectors(end, start);
        //tan.normalize();
        //var norm = new THREE.Vector3(0, 1, 0);
        //var bitan = new THREE.Vector3().crossVectors(tan, norm);

        //var geom = new THREE.Geometry();

        //var v1 = start.clone().sub(bitan.clone().multiplyScalar(width / 2));
        //var v2 = start.clone().add(bitan.clone().multiplyScalar(width / 2));
        //var v3 = end.clone().add(bitan.clone().multiplyScalar(width / 2));
        //var v4 = end.clone().sub(bitan.clone().multiplyScalar(width / 2));

        //geom.vertices.push(v1);
        //geom.vertices.push(v2);
        //geom.vertices.push(v3);
        //geom.vertices.push(v4);

        //geom.faces.push(new THREE.Face3(0, 1, 2));
        //geom.faces.push(new THREE.Face3(0, 2, 3));
        //geom.computeFaceNormals();

        var object = new THREE.Mesh(geom, this.baseMaterial);

        return object;

        //object.position.z = -100;//move a bit back - size of 500 is a bit big
        //object.rotation.y = -Math.PI * .5;//triangle is pointing in depth, rotate it -90 degrees on Y

        //scene.add(object);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    onDocumentMouseMove(event) {
        event.preventDefault();
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    }

    onDocumentMouseClick(event) {
        if (this.RAYCAST_INTERSECTED)
        {
            event.preventDefault();
            event.stopPropagation();
            
            if (this.RAYCAST_INTERSECTED.userData.dataId) {
                if (this.SELECTED != this.RAYCAST_INTERSECTED) {
                    if (this.SELECTED) this.SELECTED.scale.y = 1;
                    this.SELECTED = this.RAYCAST_INTERSECTED;
                    this.SELECTED.scale.y = 2;
                } else {
                    this.SELECTED.scale.y = 1;
                    this.SELECTED = null;
                }
                
            }
        }
    }

    run() {
        this.animate();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
        this.render();
    }

    render() {


        this.raycastIntersect();
        this.updateGrid();
        this.renderer.render(this.scene, this.camera);

    }

    updateGrid() {
        var size = 500 / 30;
        this.gridHelper.position.x = Math.floor(this.controls.target.x / size) * size;
        this.gridHelper.position.y = 0;
        this.gridHelper.position.z = Math.floor(this.controls.target.z / size) * size;


    }


    raycastIntersect() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        var intersects = this.raycaster.intersectObjects(this.scene.children);
        if (intersects.length > 0) {
            if (this.RAYCAST_INTERSECTED != intersects[0].object) {
                this.RAYCAST_INTERSECTED = intersects[0].object;
            }
        } else {
            this.RAYCAST_INTERSECTED = null;
        }

        return this.RAYCAST_INTERSECTED;
    }
}


var app = new ProcRoadApp();

app.init();
app.run();