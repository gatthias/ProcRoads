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

class NodeConnection {
    constructor() {

    }
}

class WayConnection {
    constructor() {

    }
}

// OR

class RoadConnection {
    constructor() {
        this.position = new THREE.Vector3();
        this.tangent = new THREE.Vector3();

        this.node = null;
        this.segment = null;
    }
}

class RoadNode {
    constructor() {
        this.position = new THREE.Vector3();
        this.connections = [];
    }
}

class RoadWay {
    constructor(wayInfo) {
        this.nodes = [];

        this.segments = [];
    }
}

class RoadSegment {
    constructor(/* ..., */ roadWay) {
        this.connections = [];

        this.way = roadWay;
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

        document.addEventListener('mousemove', e => this.onDocumentMouseMove(e), false);
        document.addEventListener('click', e => this.onDocumentMouseClick(e), false);
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    initNodesAndWays() {
        // Link nodes & ways
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
    }

    createNodeCube(node) {
        var mesh = new THREE.Mesh(this.nodePlaceholderGeometry, new THREE.MeshNormalMaterial());

        mesh.position.x = node.location.x * 100;
        mesh.position.y = 5;
        mesh.position.z = node.location.y * 100;

        mesh.userData.dataId = "n-"+node.id;

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